import { ShoppingBag, ExternalLink, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProductSuggestion } from "@/lib/generateRoom";

const CATEGORY_ICONS: Record<string, string> = {
  storage: "Storage",
  organizer: "Organizer",
  furniture: "Furniture",
  cleaning: "Cleaning",
  decor: "Decor",
  lighting: "Lighting",
  container: "Container",
};

interface ProductCardProps {
  product: ProductSuggestion;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(product.search_query)}`;
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(product.search_query)}&tbm=shop`;

  return (
    <Card className="group hover:shadow-card transition-all duration-200 hover:-translate-y-0.5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-soft text-primary">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-foreground leading-tight">{product.name}</h4>
              <Badge variant="secondary" className="text-[10px] mt-0.5 px-1.5 py-0">
                {CATEGORY_ICONS[product.category] ?? product.category}
              </Badge>
            </div>
          </div>
          <span className="text-sm font-bold text-primary whitespace-nowrap">{product.price_range}</span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{product.reason}</p>

        <div className="flex gap-2">
          <a
            href={amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-md bg-secondary hover:bg-primary-soft"
          >
            <Tag className="w-3 h-3" />
            Amazon
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-md bg-secondary hover:bg-primary-soft"
          >
            <ShoppingBag className="w-3 h-3" />
            Google Shopping
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
};
