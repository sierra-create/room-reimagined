import { supabase } from "@/integrations/supabase/client";

export type StyleKey = "minimalist" | "cozy" | "modern" | "bohemian";

export async function generateRevampedRoom(
  inputImage: string,
  style: StyleKey
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("reorganize-room", {
    body: { image: inputImage, style },
  });

  if (error) {
    // Surface friendly server-provided message when present
    const ctx = (error as any).context;
    if (ctx?.body) {
      try {
        const parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
        if (parsed?.error) throw new Error(parsed.error);
      } catch (_) { /* fall through */ }
    }
    throw new Error(error.message || "Failed to reorganize room");
  }

  if (!data?.image) throw new Error("No image returned");
  return data.image as string;
}
