// Edge function: suggest-items
// Given a room photo + style, suggest NEW items the user could add to better
// fit the space and chosen aesthetic. Returns structured JSON via tool calling.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STYLE_DESCRIPTIONS: Record<string, string> = {
  minimalist: "minimalist — clean, neutral palette, uncluttered, only essentials",
  cozy: "cozy — warm textiles, soft lighting, layered comfort",
  modern: "modern — sleek lines, geometric forms, bold accents",
  bohemian: "bohemian — eclectic patterns, plants, woven textures, vintage finds",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image, style } = await req.json();
    if (!image || !style) {
      return new Response(JSON.stringify({ error: "Missing image or style" }), {
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

    const styleDesc = STYLE_DESCRIPTIONS[style] ?? STYLE_DESCRIPTIONS.minimalist;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an interior designer. Look at a room photo and suggest NEW items the user could add (not items already in the room) that would elevate the space in the chosen style. Be practical, specific, and budget-conscious.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `This room should feel ${styleDesc}. Suggest 5 new items the user could add (things NOT already in the photo) to better achieve this vibe. For each item include: a short name, a one-sentence reason it fits this room and style, and a rough price range in USD (e.g. "$30–80").`,
              },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_items",
              description: "Return 5 suggested new items for the room.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        reason: { type: "string" },
                        price_range: { type: "string" },
                      },
                      required: ["name", "reason", "price_range"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_items" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, text);
      return new Response(JSON.stringify({ error: "AI suggestion failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    let suggestions: Array<{ name: string; reason: string; price_range: string }> = [];
    try {
      const parsed = typeof argsStr === "string" ? JSON.parse(argsStr) : argsStr;
      suggestions = parsed?.suggestions ?? [];
    } catch (e) {
      console.error("Failed to parse suggestions:", e, argsStr);
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-items error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
