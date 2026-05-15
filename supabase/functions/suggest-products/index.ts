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
    const { image, analysis } = await req.json();
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

    const analysisContext = analysis
      ? `\n\nHere is the AI analysis of this space:\n- Clutter score: ${analysis.clutter_score}/10\n- Organization score: ${analysis.organization_score}/10\n- Main issues: ${JSON.stringify(analysis.main_issues)}\n- Storage needs: ${JSON.stringify(analysis.storage_needs)}`
      : "";

    const prompt = `You are a professional organizer and home goods expert. Look at this room/space photo and suggest products that would help organize, declutter, and improve the space.${analysisContext}

For each product, provide:
- "name": Short product name (e.g., "Over-Door Shoe Organizer")
- "reason": One sentence explaining why this specific product would help THIS space
- "category": One of: "storage", "organizer", "furniture", "cleaning", "decor", "lighting", "container"
- "price_range": Rough price range in USD (e.g., "$15-30")
- "search_query": 3-6 words someone could type into Amazon or Google Shopping to find it (e.g., "over door shoe organizer clear pockets")
- "priority": 1-5 (1 = most essential for this space)

Suggest 6-8 products. Focus on practical organization solutions that directly address the problems visible in the photo. Include a mix of budget-friendly and mid-range options. Prioritize items that solve the biggest problems first.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_products",
              description: "Return product suggestions for organizing the space.",
              parameters: {
                type: "object",
                properties: {
                  products: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        reason: { type: "string" },
                        category: { type: "string" },
                        price_range: { type: "string" },
                        search_query: { type: "string" },
                        priority: { type: "number" },
                      },
                      required: ["name", "reason", "category", "price_range", "search_query", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["products"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_products" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), {
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
      const text = await res.text();
      console.error("AI gateway error:", res.status, text);
      return new Response(JSON.stringify({ error: "Product suggestion failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    let products: Array<{
      name: string;
      reason: string;
      category: string;
      price_range: string;
      search_query: string;
      priority: number;
    }> = [];
    try {
      const parsed = typeof argsStr === "string" ? JSON.parse(argsStr) : argsStr;
      products = parsed?.products ?? [];
      products.sort((a, b) => a.priority - b.priority);
    } catch (e) {
      console.error("Failed to parse products:", e, argsStr);
    }

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-products error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
