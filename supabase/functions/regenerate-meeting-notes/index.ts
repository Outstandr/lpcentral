import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meeting_id } = await req.json();

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: 'meeting_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch meeting with transcript
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, transcript, created_by')
      .eq('id', meeting_id)
      .single();

    if (meetingError || !meeting) {
      console.error('Meeting not found:', meetingError);
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!meeting.transcript) {
      return new Response(
        JSON.stringify({ error: 'No transcript available to analyze' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Regenerating notes for meeting:', meeting.id);
    console.log('Transcript length:', meeting.transcript.length, 'characters');

    // Generate AI summary with Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: `You are an expert meeting analyst. Analyze the meeting transcript thoroughly and extract all important information.

You MUST return a valid JSON object with this exact structure:
{
  "summary": "A comprehensive 3-5 sentence overview covering the main topics, participants' perspectives, and overall outcome",
  "key_points": [{"point": "Detailed description of the key point", "importance": "high|medium|low"}],
  "action_items": [{"task": "Specific actionable task", "owner": "Person responsible or 'Unassigned'", "deadline": "Deadline or 'TBD'"}],
  "decisions": [{"decision": "Clear statement of what was decided", "context": "Why this decision was made"}]
}

Guidelines:
- Extract ALL important discussion points, even from long meetings
- Identify 5-10 key points for comprehensive meetings
- Capture every action item mentioned, even implied ones
- Note all decisions, both explicit and consensus-based
- Use speaker names if identifiable from the transcript
- Be thorough - this is a professional meeting record`
          },
          {
            role: 'user',
            content: `Analyze this meeting transcript completely:\n\n${meeting.transcript}`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    console.log('AI response received, content length:', content.length);

    // Parse JSON from response
    let jsonStr = content.trim();
    
    // Try different patterns to extract JSON
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    } else {
      const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }
    }

    let notes;
    try {
      notes = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw content (first 1000 chars):', content.substring(0, 1000));
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed notes:', {
      hasSummary: !!notes.summary,
      keyPointsCount: notes.key_points?.length || 0,
      actionItemsCount: notes.action_items?.length || 0,
      decisionsCount: notes.decisions?.length || 0,
    });

    // Delete existing notes for this meeting
    await supabase
      .from('meeting_notes')
      .delete()
      .eq('meeting_id', meeting.id);

    // Insert new meeting notes
    const { data: notesData, error: notesError } = await supabase
      .from('meeting_notes')
      .insert({
        meeting_id: meeting.id,
        summary: notes.summary || 'No summary available',
        key_points: notes.key_points || [],
        action_items: notes.action_items || [],
        decisions: notes.decisions || [],
      })
      .select()
      .single();

    if (notesError) {
      console.error('Error saving notes:', notesError);
      return new Response(
        JSON.stringify({ error: 'Failed to save notes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Meeting notes regenerated successfully:', notesData.id);

    return new Response(
      JSON.stringify({
        success: true,
        notes: notesData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error regenerating notes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
