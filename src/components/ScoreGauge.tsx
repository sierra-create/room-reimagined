import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  max?: number;
  label: string;
  colorClass?: string;
}

export const ScoreGauge = ({ score, max = 10, label, colorClass }: ScoreGaugeProps) => {
  const percentage = (score / max) * 100;
  const defaultColor = score <= 3 ? "bg-red-500" : score <= 6 ? "bg-amber-500" : "bg-emerald-500";
  const color = colorClass ?? defaultColor;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-bold text-foreground">{score}/{max}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
