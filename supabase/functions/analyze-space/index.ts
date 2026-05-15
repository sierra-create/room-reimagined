import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "Missing image" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a professional space organizer and decluttering expert. Analyze this room/space photo in detail.

Provide a comprehensive analysis as JSON with these fields:
- "room_type": What type of room this is (bedroom, kitchen, living room, garage, office, closet, bathroom, laundry room, etc.)
- "clutter_score": 1-10 rating of how cluttered/messy the space is (1=perfectly organized, 10=extremely cluttered)
- "organization_score": 1-10 rating of how well-organized the space is (1=chaos, 10=perfectly organized)
- "main_issues": Array of 3-5 main organizational issues you see (e.g., "Clothes piled on chair", "No visible storage system", "Items scattered on floor")
- "strengths": Array of 1-3 things that are already working well
- "quick_wins": Array of 3-5 things the user could do in under 10 minutes to improve the space
- "rearrangement_ideas": Array of 3-5 specific rearrangement suggestions (e.g., "Move desk to face the window for natural light", "Rotate bed 90 degrees to create a reading nook")
- "storage_needs": Array of 2-4 storage solutions that would help (e.g., "Over-door shoe organizer", "Floating shelf above desk")
- "estimated_time": Rough estimate of how long a full reorganization would take (e.g., "2-3 hours", "1 full day")

Respond with ONLY the JSON object, no markdown, no prose.`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", res.status, text);
      return new Response(JSON.stringify({ error: "Analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Could not parse analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(match[0]);
    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-space error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
