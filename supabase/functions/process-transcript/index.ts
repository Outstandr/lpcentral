import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();

    if (!transcript || transcript.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'No transcript provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing transcript with AI, length:', transcript.length);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing daily reflection/journal transcripts. Extract structured data from the transcript.

You MUST return a valid JSON object with this exact structure:
{
  "tasks_completed": [{"task": "Description of completed task"}],
  "challenges": [{"challenge": "Description of challenge faced"}],
  "key_learnings": [{"learning": "Key insight or learning"}],
  "sentiment": "positive" | "neutral" | "negative",
  "energy_level": 1-10
}

Guidelines:
- Extract ALL tasks mentioned as completed
- Identify challenges, obstacles, or difficulties mentioned
- Capture key learnings, insights, or realizations
- Assess overall sentiment from tone and content
- Estimate energy level (1=very low/tired, 10=very high/energized)
- Be thorough but concise in descriptions
- If information is not mentioned, use empty arrays or reasonable defaults`
          },
          {
            role: 'user',
            content: `Analyze this daily reflection transcript:\n\n${transcript}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted, please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI processing failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    console.log('AI response received, content length:', content.length);

    // Parse JSON from response
    let structuredData = {
      tasks_completed: [],
      challenges: [],
      key_learnings: [],
      sentiment: 'neutral',
      energy_level: 5,
    };

    try {
      let jsonStr = content.trim();
      
      // Extract JSON from potential markdown code blocks
      const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1].trim();
      } else {
        const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonStr = jsonObjectMatch[0];
        }
      }
      
      const parsed = JSON.parse(jsonStr);
      structuredData = {
        tasks_completed: parsed.tasks_completed || [],
        challenges: parsed.challenges || [],
        key_learnings: parsed.key_learnings || [],
        sentiment: parsed.sentiment || 'neutral',
        energy_level: parsed.energy_level || 5,
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw content:', content.substring(0, 500));
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...structuredData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing transcript:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
