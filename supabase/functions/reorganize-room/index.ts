// Edge function: reorganize-room
// Takes a room photo + style key, asks Lovable AI (Nano Banana) to generate a
// reimagined version of the same room rearranged in that style.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STYLE_PROMPTS: Record<string, string> = {
  minimalist:
    "minimalist style: clean and uncluttered, neutral palette (whites, warm beiges, light woods), open negative space, only essential furniture neatly arranged, soft natural light",
  cozy:
    "cozy style: warm layered textiles, chunky throws and pillows, warm ambient lighting, soft rugs, books and candles, inviting and lived-in but tidy arrangement",
  modern:
    "modern style: sleek geometric furniture, bold accent colors, clean lines, contemporary lighting fixtures, marble or matte black accents, polished and intentional layout",
  bohemian:
    "bohemian style: eclectic mix of patterns, lots of plants, macrame and woven textures, vintage rugs, warm earthy and vibrant tones, layered but harmonious arrangement",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, style } = await req.json();
    if (!image || !style) {
      return new Response(JSON.stringify({ error: "Missing image or style" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stylePrompt = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.minimalist;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an expert interior organizer. FULLY REGENERATE this exact room as a brand new photorealistic image where the SAME items have been physically MOVED to NEW positions, in a ${stylePrompt} aesthetic.

THIS IS A REARRANGEMENT TASK — THE OUTPUT MUST LOOK VISIBLY DIFFERENT FROM THE INPUT.

ABSOLUTE RULES (do not violate any):
1. DO NOT return the input image. DO NOT return a near-identical copy. Items MUST be in noticeably different physical positions than the original.
2. DO NOT add ANY new objects: no new furniture, no new decor, no new plants, no new rugs, no new art, no new pillows, no new towels, no new blankets, no new books, NOTHING that wasn't already visible in the original photo. Adding items is a complete failure of the task.
3. DO NOT remove existing furniture or belongings. You MAY remove only: trash, loose papers, wrappers, dirty laundry on the floor, and visible dust/dirt.
4. Keep the SAME room shell: same walls, paint, windows, doors, flooring, ceiling, built-in lighting fixtures, and the SAME camera angle / perspective / focal length.
5. Every visible object from the original must still appear in the output — just MOVED, rotated, stacked, folded, straightened, grouped, or repositioned to feel intentional and styled in the chosen vibe.
6. Preserve each object's identity: same colors, materials, patterns, and approximate size.

Before outputting, mentally check: "Have I actually moved items to new locations? Did I avoid inventing anything new?" If not, redo it.

Output: ONE photorealistic image of the SAME room from the SAME camera angle, with the SAME items rearranged into a clearly different, more organized layout.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, text);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const generatedUrl: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedUrl) {
      console.error("No image in AI response", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI did not return an image. Try a different photo." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ image: generatedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reorganize-room error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
