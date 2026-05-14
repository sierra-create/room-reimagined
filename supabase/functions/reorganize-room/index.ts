// Edge function: reorganize-room
// Takes a room photo + style key, asks Lovable AI (Nano Banana) to generate a
// reimagined version of the same room rearranged in that style.
// Includes an automatic retry loop: after generating, a verifier model compares
// before/after. If the result looks too similar OR introduces new items, we
// regenerate (up to MAX_ATTEMPTS) with stronger guidance.

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

const MAX_ATTEMPTS = 3;
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function buildPrompt(stylePrompt: string, attempt: number, lastIssue?: string) {
  const escalation =
    attempt === 0
      ? ""
      : `\n\nPREVIOUS ATTEMPT FAILED VERIFICATION: ${lastIssue}\nThis time you MUST move items to dramatically different positions and you MUST NOT introduce any object that wasn't in the original photo. Be bolder with the rearrangement.`;

  return `You are an expert interior organizer. FULLY REGENERATE this exact room as a brand new photorealistic image where the SAME items have been physically MOVED to NEW positions, in a ${stylePrompt} aesthetic.

THIS IS A REARRANGEMENT TASK — THE OUTPUT MUST LOOK VISIBLY DIFFERENT FROM THE INPUT.

ABSOLUTE RULES (do not violate any):
1. DO NOT return the input image. DO NOT return a near-identical copy. Items MUST be in noticeably different physical positions than the original.
2. DO NOT add ANY new objects: no new furniture, no new decor, no new plants, no new rugs, no new art, no new pillows, no new towels, no new blankets, no new books, NOTHING that wasn't already visible in the original photo. Adding items is a complete failure of the task.
3. DO NOT remove existing furniture or belongings. You MAY remove only: trash, loose papers, wrappers, dirty laundry on the floor, and visible dust/dirt.
4. Keep the SAME room shell: same walls, paint, windows, doors, flooring, ceiling, built-in lighting fixtures, and the SAME camera angle / perspective / focal length.
5. Every visible object from the original must still appear in the output — just MOVED, rotated, stacked, folded, straightened, grouped, or repositioned to feel intentional and styled in the chosen vibe.
6. Preserve each object's identity: same colors, materials, patterns, and approximate size.

Before outputting, mentally check: "Have I actually moved items to new locations? Did I avoid inventing anything new?" If not, redo it.${escalation}

Output: ONE photorealistic image of the SAME room from the SAME camera angle, with the SAME items rearranged into a clearly different, more organized layout.`;
}

async function generateImage(apiKey: string, prompt: string, image: string): Promise<string | null> {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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

  if (!res.ok) {
    const text = await res.text();
    const err: any = new Error(`AI gateway ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
}

type Verdict = { ok: boolean; reason: string; tooSimilar: boolean; newItems: boolean };

async function verifyResult(apiKey: string, before: string, after: string): Promise<Verdict> {
  const verifierPrompt = `You are a strict QA auditor for a room-rearrangement AI. Compare the two photos:
- BEFORE: the user's original room.
- AFTER: the AI's rearranged version.

Two failure conditions:
A) "too_similar" — items are in essentially the same positions; the AFTER looks like the BEFORE with only trivial changes (e.g. only lighting/cleanup, no actual rearrangement).
B) "new_items" — the AFTER contains an object class that was NOT visible in the BEFORE (e.g. a stack of towels, a plant, a rug, a piece of art, pillows, books). Removing trash/clutter is fine. Slight inference of partially-occluded items is fine.

Respond with ONLY a compact JSON object, no prose, no markdown:
{"too_similar": boolean, "new_items": boolean, "reason": "<one short sentence>"}`;

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: verifierPrompt },
            { type: "text", text: "BEFORE:" },
            { type: "image_url", image_url: { url: before } },
            { type: "text", text: "AFTER:" },
            { type: "image_url", image_url: { url: after } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    // If verifier fails, don't block — accept the image.
    console.warn("verifier failed", res.status, await res.text());
    return { ok: true, reason: "verifier unavailable", tooSimilar: false, newItems: false };
  }
  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { ok: true, reason: "no verdict json", tooSimilar: false, newItems: false };
  try {
    const parsed = JSON.parse(match[0]);
    const tooSimilar = !!parsed.too_similar;
    const newItems = !!parsed.new_items;
    return {
      ok: !tooSimilar && !newItems,
      reason: parsed.reason ?? "",
      tooSimilar,
      newItems,
    };
  } catch {
    return { ok: true, reason: "verdict parse failed", tooSimilar: false, newItems: false };
  }
}

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

    let lastImage: string | null = null;
    let lastVerdict: Verdict | null = null;
    let lastIssue: string | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const prompt = buildPrompt(stylePrompt, attempt, lastIssue);
      let generated: string | null = null;
      try {
        generated = await generateImage(LOVABLE_API_KEY, prompt, image);
      } catch (e: any) {
        if (e?.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (e?.status === 402) {
          return new Response(
            JSON.stringify({
              error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage.",
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.error("generation error attempt", attempt, e);
        continue;
      }

      if (!generated) {
        lastIssue = "Model returned no image.";
        continue;
      }

      lastImage = generated;
      const verdict = await verifyResult(LOVABLE_API_KEY, image, generated);
      lastVerdict = verdict;
      console.log(`attempt ${attempt} verdict`, verdict);

      if (verdict.ok) {
        return new Response(
          JSON.stringify({ image: generated, attempts: attempt + 1, verdict }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const issues: string[] = [];
      if (verdict.tooSimilar) issues.push("the AFTER looked too similar to the BEFORE");
      if (verdict.newItems) issues.push("the AFTER introduced items that weren't in the original");
      lastIssue = `${issues.join(" and ")}. Auditor note: ${verdict.reason}`;
    }

    if (lastImage) {
      // All retries failed verification; return best effort with a flag.
      return new Response(
        JSON.stringify({
          image: lastImage,
          attempts: MAX_ATTEMPTS,
          verdict: lastVerdict,
          warning:
            "We tried a few times but the rearrangement may still look similar to your original. Try a different style or photo.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "AI did not return an image. Try a different photo." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("reorganize-room error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
