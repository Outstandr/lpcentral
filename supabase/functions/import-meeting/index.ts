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
    const { title, transcript, external_id, channel_id, api_key } = await req.json();

    // Validate API key
    const IMPORT_API_KEY = Deno.env.get('IMPORT_MEETING_API_KEY');
    if (!IMPORT_API_KEY || api_key !== IMPORT_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'No transcript provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check for duplicate using external_id
    if (external_id) {
      const { data: existing } = await supabase
        .from('meetings')
        .select('id')
        .eq('external_id', external_id)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            duplicate: true, 
            meeting_id: existing.id,
            message: 'Meeting already imported' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Creating meeting record for:', title);

    // Get or create a system user for imports (use a consistent ID)
    // We'll use the first admin user as the creator
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    const createdBy = adminRole?.user_id;
    
    if (!createdBy) {
      return new Response(
        JSON.stringify({ error: 'No admin user found to assign as meeting creator' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create meeting record
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        title: title || 'Google Meet Transcript',
        transcript,
        external_id: external_id || null,
        channel_id: channel_id || null,
        created_by: createdBy,
        status: 'processing',
        source: 'google-meet',
      })
      .select()
      .single();

    if (meetingError) {
      console.error('Error creating meeting:', meetingError);
      throw meetingError;
    }

    console.log('Meeting created:', meeting.id);

    // Generate AI summary with Lovable AI
    console.log('Generating AI summary...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a meeting analyst. Analyze the meeting transcript and extract key information.
            
Return a valid JSON object with this exact structure:
{
  "summary": "2-3 sentence overview of the meeting",
  "key_points": [{"point": "...", "importance": "high|medium|low"}],
  "action_items": [{"task": "...", "owner": "...", "deadline": "..."}],
  "decisions": [{"decision": "...", "context": "..."}]
}

If there's no clear owner or deadline for an action item, use "Unassigned" or "TBD".
Extract at least 3-5 key points if possible.
Be concise but comprehensive.`
          },
          {
            role: 'user',
            content: `Analyze this meeting transcript:\n\n${transcript}`
          }
        ],
        temperature: 0.3,
      }),
    });

    let meetingNotes = null;

    if (aiResponse.ok) {
      const aiResult = await aiResponse.json();
      const content = aiResult.choices?.[0]?.message?.content || '';
      
      try {
        // Extract JSON from potential markdown code blocks
        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        
        const notes = JSON.parse(jsonStr);
        
        // Insert meeting notes
        const { data: notesData, error: notesError } = await supabase
          .from('meeting_notes')
          .insert({
            meeting_id: meeting.id,
            summary: notes.summary || '',
            key_points: notes.key_points || [],
            action_items: notes.action_items || [],
            decisions: notes.decisions || [],
          })
          .select()
          .single();

        if (notesError) {
          console.error('Error saving notes:', notesError);
        } else {
          meetingNotes = notesData;
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError, content);
      }
    } else {
      console.error('AI response error:', await aiResponse.text());
    }

    // Update meeting status
    await supabase
      .from('meetings')
      .update({ status: 'completed' })
      .eq('id', meeting.id);

    console.log('Meeting import complete:', meeting.id);

    return new Response(
      JSON.stringify({
        success: true,
        meeting_id: meeting.id,
        has_notes: !!meetingNotes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error importing meeting:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
