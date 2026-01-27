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
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const title = formData.get('title') as string || 'Untitled Meeting';
    const channelId = formData.get('channel_id') as string | null;

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key not configured' }),
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

    console.log('Creating meeting record...');
    
    // Create meeting record with pending status
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        title,
        channel_id: channelId || null,
        created_by: userId,
        status: 'processing',
        source: 'recorder',
      })
      .select()
      .single();

    if (meetingError) {
      console.error('Error creating meeting:', meetingError);
      throw meetingError;
    }

    console.log('Meeting created:', meeting.id);

    // Upload audio to storage
    const audioBuffer = await audioFile.arrayBuffer();
    const fileName = `${meeting.id}.webm`;
    
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('chat-files')
      .upload(`meetings/${fileName}`, audioBuffer, {
        contentType: 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
    } else {
      const { data: { publicUrl } } = supabase
        .storage
        .from('chat-files')
        .getPublicUrl(`meetings/${fileName}`);
      
      await supabase
        .from('meetings')
        .update({ audio_url: publicUrl })
        .eq('id', meeting.id);
    }

    console.log('Transcribing with ElevenLabs...');

    // Transcribe with ElevenLabs
    const transcribeFormData = new FormData();
    transcribeFormData.append('file', audioFile);
    transcribeFormData.append('model_id', 'scribe_v2');
    transcribeFormData.append('tag_audio_events', 'true');
    transcribeFormData.append('diarize', 'true');

    const transcribeResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: transcribeFormData,
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error('ElevenLabs error:', errorText);
      
      await supabase
        .from('meetings')
        .update({ status: 'failed' })
        .eq('id', meeting.id);
        
      return new Response(
        JSON.stringify({ error: 'Transcription failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcription = await transcribeResponse.json();
    const transcript = transcription.text || '';

    console.log('Transcript received, length:', transcript.length);

    // Update meeting with transcript
    await supabase
      .from('meetings')
      .update({ transcript })
      .eq('id', meeting.id);

    // Generate AI summary with Lovable AI
    console.log('Generating AI summary...');
    console.log('Transcript length:', transcript.length, 'characters');

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
            content: `Analyze this meeting transcript completely:\n\n${transcript}`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    let meetingNotes = null;

    if (aiResponse.ok) {
      const aiResult = await aiResponse.json();
      const content = aiResult.choices?.[0]?.message?.content || '';
      console.log('AI response received, content length:', content.length);
      
      // Parse JSON from response
      try {
        // Extract JSON from potential markdown code blocks
        let jsonStr = content.trim();
        
        // Try different patterns to extract JSON
        const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
          jsonStr = jsonBlockMatch[1].trim();
        } else {
          // Try to find JSON object directly
          const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            jsonStr = jsonObjectMatch[0];
          }
        }
        
        console.log('Parsing JSON, length:', jsonStr.length);
        const notes = JSON.parse(jsonStr);
        console.log('Parsed notes successfully:', {
          hasSummary: !!notes.summary,
          keyPointsCount: notes.key_points?.length || 0,
          actionItemsCount: notes.action_items?.length || 0,
          decisionsCount: notes.decisions?.length || 0,
        });
        
        // Insert meeting notes
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
          console.error('Error saving notes to database:', notesError);
        } else {
          console.log('Meeting notes saved successfully:', notesData.id);
          meetingNotes = notesData;
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.error('Raw content (first 1000 chars):', content.substring(0, 1000));
        
        // Try to save a fallback note with raw summary
        try {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('meeting_notes')
            .insert({
              meeting_id: meeting.id,
              summary: 'AI analysis failed to parse. Please regenerate.',
              key_points: [],
              action_items: [],
              decisions: [],
            })
            .select()
            .single();
          
          if (!fallbackError) {
            meetingNotes = fallbackData;
          }
        } catch (e) {
          console.error('Fallback save also failed:', e);
        }
      }
    } else {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
    }

    // Update meeting status
    await supabase
      .from('meetings')
      .update({ status: 'completed' })
      .eq('id', meeting.id);

    console.log('Meeting processing complete');

    return new Response(
      JSON.stringify({
        success: true,
        meeting_id: meeting.id,
        transcript,
        notes: meetingNotes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing meeting:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
