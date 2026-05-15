import { supabase } from "@/integrations/supabase/client";

export interface SpaceAnalysis {
  room_type: string;
  clutter_score: number;
  organization_score: number;
  main_issues: string[];
  strengths: string[];
  quick_wins: string[];
  rearrangement_ideas: string[];
  storage_needs: string[];
  estimated_time: string;
}

export interface RearrangeResult {
  image: string;
  attempts?: number;
  warning?: string;
}

export interface ProductSuggestion {
  name: string;
  reason: string;
  category: string;
  price_range: string;
  search_query: string;
  priority: number;
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

export async function analyzeSpace(
  inputImage: string
): Promise<SpaceAnalysis> {
  const { data, error } = await supabase.functions.invoke("analyze-space", {
    body: { image: inputImage },
  });

  if (error) {
    const message = await getFunctionErrorMessage(error);
    if (message) throw new Error(message);
    throw new Error(error.message || "Failed to analyze space");
  }

  if (!data?.analysis) throw new Error("No analysis returned");
  return data.analysis as SpaceAnalysis;
}

export async function rearrangeSpace(
  inputImage: string
): Promise<RearrangeResult> {
  const { data, error } = await supabase.functions.invoke("rearrange-space", {
    body: { image: inputImage },
  });

  if (error) {
    const message = await getFunctionErrorMessage(error);
    if (message) throw new Error(message);
    throw new Error(error.message || "Failed to rearrange space");
  }

  if (!data?.image) throw new Error("No image returned");
  return { image: data.image, attempts: data.attempts, warning: data.warning };
}

export async function suggestProducts(
  inputImage: string,
  analysis?: SpaceAnalysis
): Promise<ProductSuggestion[]> {
  const { data, error } = await supabase.functions.invoke("suggest-products", {
    body: { image: inputImage, analysis: analysis ?? null },
  });

  if (error) {
    const message = await getFunctionErrorMessage(error);
    if (message) throw new Error(message);
    throw new Error(error.message || "Failed to fetch product suggestions");
  }

  return (data?.products ?? []) as ProductSuggestion[];
}
