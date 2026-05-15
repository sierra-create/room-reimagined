import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_ATTEMPTS = 3;

function buildPrompt(attempt: number, lastIssue?: string): string {
  const escalation =
    attempt === 0
      ? ""
      : `\n\nPREVIOUS ATTEMPT FAILED: ${lastIssue}\nThis time you MUST move items to dramatically different positions. Be bolder with the rearrangement.`;

  return `You are an expert space organizer and declutterer. FULLY REGENERATE this exact room as a brand new photorealistic image where the SAME items have been physically MOVED to NEW positions to create a clean, organized, and functional layout.

THIS IS A REORGANIZATION TASK — THE OUTPUT MUST LOOK VISIBLY DIFFERENT FROM THE INPUT.

ABSOLUTE RULES (do not violate any):
1. DO NOT return the input image. Items MUST be in noticeably different physical positions than the original.
2. DO NOT add ANY new objects: no new furniture, no new decor, no new plants, no new rugs, no new storage bins, NOTHING that wasn't already visible in the original photo.
3. DO NOT remove existing furniture or belongings. You MAY remove only: trash, loose papers, wrappers, dirty laundry on the floor, and visible dust/dirt.
4. Keep the SAME room shell: same walls, paint, windows, doors, flooring, ceiling, built-in lighting fixtures, and the SAME camera angle / perspective / focal length.
5. Every visible object from the original must still appear in the output — just MOVED, rotated, stacked, folded, straightened, grouped, or repositioned to feel intentional and organized.
6. Preserve each object's identity: same colors, materials, patterns, and approximate size.
7. The goal is ORGANIZATION: items should be neatly arranged, grouped by function, surfaces should be clear where possible, and the space should feel functional and tidy.

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

type AddedItem = {
  name: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
};

type Verdict = {
  ok: boolean;
  reason: string;
  tooSimilar: boolean;
  newItems: boolean;
  addedItems: AddedItem[];
  verificationFailed?: boolean;
};

function normalizeAddedItems(value: unknown): AddedItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: typeof item?.name === "string" ? item.name.trim() : "new item",
      evidence: typeof item?.evidence === "string" ? item.evidence.trim() : "Visible in AFTER but not BEFORE.",
      confidence: ["high", "medium", "low"].includes(item?.confidence) ? item.confidence : "medium",
    }))
    .filter((item) => item.name.length > 0);
}

async function verifyResult(apiKey: string, before: string, after: string): Promise<Verdict> {
  const verifierPrompt = `You are a strict image-diff QA auditor for a room-reorganization AI. Compare the two photos:
- BEFORE: the user's original room.
- AFTER: the AI's reorganized version.

Two failure conditions:
A) "too_similar" — items are in essentially the same positions; the AFTER looks like the BEFORE with only trivial changes.
B) "new_items" — the AFTER contains any tangible object that was NOT visible in the BEFORE.

For "new_items", run an object-presence diff:
- Flag added furniture, decor, textiles, storage bins, containers, and any other tangible objects.
- Do NOT flag objects that clearly existed in BEFORE but were moved, rotated, folded, stacked, or straightened.
- Do NOT flag lighting changes, shadows, cleaner surfaces, removed trash, or reduced clutter.
- If uncertain, only mark confidence "low" and do not set "new_items" true unless at least one added item has medium or high confidence.

Respond with ONLY a compact JSON object, no prose, no markdown:
{"too_similar": boolean, "new_items": boolean, "added_items": [{"name": "<object>", "evidence": "<why>", "confidence": "high|medium|low"}], "reason": "<one short sentence>"}`;

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
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
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    console.warn("verifier failed", res.status, await res.text());
    return {
      ok: false,
      reason: "Verifier unavailable",
      tooSimilar: false,
      newItems: false,
      addedItems: [],
      verificationFailed: true,
    };
  }

  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      ok: false,
      reason: "Verifier did not return a readable verdict",
      tooSimilar: false,
      newItems: false,
      addedItems: [],
      verificationFailed: true,
    };
  }

  try {
    const parsed = JSON.parse(match[0]);
    const tooSimilar = !!parsed.too_similar;
    const addedItems = normalizeAddedItems(parsed.added_items);
    const hasConfidentAddedItem = addedItems.some((item) => item.confidence !== "low");
    const newItems = !!parsed.new_items && hasConfidentAddedItem;
    return {
      ok: !tooSimilar && !newItems,
      reason: parsed.reason ?? "",
      tooSimilar,
      newItems,
      addedItems,
    };
  } catch {
    return {
      ok: false,
      reason: "Verifier verdict could not be parsed",
      tooSimilar: false,
      newItems: false,
      addedItems: [],
      verificationFailed: true,
    };
  }
}

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

    let lastImage: string | null = null;
    let lastVerdict: Verdict | null = null;
    let lastIssue: string | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const prompt = buildPrompt(attempt, lastIssue);
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
            JSON.stringify({ error: "AI credits exhausted." }),
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
          JSON.stringify({ image: generated, attempts: attempt + 1 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const issues: string[] = [];
      if (verdict.tooSimilar) issues.push("the AFTER looked too similar to the BEFORE");
      if (verdict.newItems) {
        const added = verdict.addedItems.map((item) => item.name).join(", ");
        issues.push(`the AFTER introduced items not in the original${added ? ` (${added})` : ""}`);
      }
      lastIssue = `${issues.join(" and ")}. ${verdict.reason}`;
    }

    if (lastVerdict?.verificationFailed) {
      return new Response(
        JSON.stringify({ error: "We couldn't verify the rearrangement. Please try again." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (lastVerdict?.newItems) {
      const added = lastVerdict.addedItems.map((item) => item.name).filter(Boolean).join(", ");
      return new Response(
        JSON.stringify({
          error: added
            ? `The generated image added items not in your photo: ${added}. Please try again.`
            : "The generated image added items not in your photo. Please try again.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (lastImage) {
      return new Response(
        JSON.stringify({
          image: lastImage,
          attempts: MAX_ATTEMPTS,
          warning: "The rearrangement may still look similar to your original. Try a different photo.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "AI did not return an image. Try a different photo." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("rearrange-space error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
