import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Lightbulb, ArrowRight, Clock, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreGauge } from "@/components/ScoreGauge";
import type { SpaceAnalysis } from "@/lib/generateRoom";

interface AnalysisPanelProps {
  analysis: SpaceAnalysis;
}

export const AnalysisPanel = ({ analysis }: AnalysisPanelProps) => {
  return (
    <div className="space-y-4">
      {/* Scores */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <ScoreGauge score={analysis.clutter_score} label="Clutter Level" />
          <ScoreGauge score={analysis.organization_score} label="Organization Level" />
          <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Estimated time to organize: <strong className="text-foreground">{analysis.estimated_time}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Main Issues */}
      <Card>
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Main Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ul className="space-y-2">
            {analysis.main_issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {issue}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Strengths */}
      {analysis.strengths.length > 0 && (
        <Card>
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              What's Working
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ul className="space-y-1.5">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Quick Wins */}
      <Card>
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            Quick Wins (Under 10 min)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ul className="space-y-1.5">
            {analysis.quick_wins.map((win, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                {win}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Rearrangement Ideas */}
      <Card>
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" />
            Rearrangement Ideas
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ul className="space-y-1.5">
            {analysis.rearrangement_ideas.map((idea, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="w-5 h-5 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {idea}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Storage Needs */}
      <Card>
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Storage Solutions Needed
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ul className="space-y-1.5">
            {analysis.storage_needs.map((need, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <Package className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                {need}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
