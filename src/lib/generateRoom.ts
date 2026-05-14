import { supabase } from "@/integrations/supabase/client";

export type StyleKey = "minimalist" | "cozy" | "modern" | "bohemian";

export interface GenerateResult {
  image: string;
  attempts?: number;
  warning?: string;
}

async function getFunctionErrorMessage(error: unknown): Promise<string | null> {
  const ctx = (error as any)?.context;
  if (!ctx) return null;

  if (typeof ctx?.json === "function") {
    try {
      const response = typeof ctx.clone === "function" ? ctx.clone() : ctx;
      const parsed = await response.json();
      return typeof parsed?.error === "string" ? parsed.error : null;
    } catch {
      try {
        const response = typeof ctx.clone === "function" ? ctx.clone() : ctx;
        const text = await response.text();
        const parsed = JSON.parse(text);
        return typeof parsed?.error === "string" ? parsed.error : null;
      } catch {
        return null;
      }
    }
  }

  const body = ctx?.body;
  if (!body) return null;

  try {
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    return typeof parsed?.error === "string" ? parsed.error : null;
  } catch {
    return null;
  }
}

export async function generateRevampedRoom(
  inputImage: string,
  style: StyleKey
): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke("reorganize-room", {
    body: { image: inputImage, style },
  });

  if (error) {
    const message = await getFunctionErrorMessage(error);
    if (message) throw new Error(message);
    throw new Error(error.message || "Failed to reorganize room");
  }

  if (!data?.image) throw new Error("No image returned");
  return { image: data.image, attempts: data.attempts, warning: data.warning };
}

export interface ItemSuggestion {
  name: string;
  reason: string;
  price_range: string;
  search_query?: string;
}

export async function suggestItems(
  inputImage: string,
  style: StyleKey
): Promise<ItemSuggestion[]> {
  const { data, error } = await supabase.functions.invoke("suggest-items", {
    body: { image: inputImage, style },
  });

  if (error) {
    const message = await getFunctionErrorMessage(error);
    if (message) throw new Error(message);
    throw new Error(error.message || "Failed to fetch suggestions");
  }

  return (data?.suggestions ?? []) as ItemSuggestion[];
}
