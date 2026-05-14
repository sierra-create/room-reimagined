import { supabase } from "@/integrations/supabase/client";

export type StyleKey = "minimalist" | "cozy" | "modern" | "bohemian";

export interface GenerateResult {
  image: string;
  attempts?: number;
  warning?: string;
}

function getFunctionErrorMessage(error: unknown): string | null {
  const ctx = (error as any)?.context;
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
    const message = getFunctionErrorMessage(error);
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
    const message = getFunctionErrorMessage(error);
    if (message) throw new Error(message);
    throw new Error(error.message || "Failed to fetch suggestions");
  }

  return (data?.suggestions ?? []) as ItemSuggestion[];
}
