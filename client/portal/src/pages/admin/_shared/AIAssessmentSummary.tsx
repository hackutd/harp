import {
  AI_CLASS_KEYS,
  AI_CLASS_LABELS,
  formatAIScore,
} from "@/shared/lib/ai-assessment";
import type { AIAssessment } from "@/types";

export function AIAssessmentSummary({
  assessment,
}: {
  assessment: AIAssessment;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">AI score</dt>
        <dd className="mt-1 tabular-nums">
          {formatAIScore(assessment.ai_score)}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Verdict</dt>
        <dd className="mt-1">
          {assessment.verdict ? AI_CLASS_LABELS[assessment.verdict] : "Not set"}
        </dd>
      </div>
      {AI_CLASS_KEYS.map((key) => (
        <div key={key}>
          <dt className="text-xs text-muted-foreground">
            {AI_CLASS_LABELS[key]}
          </dt>
          <dd className="mt-1 tabular-nums">
            {formatAIScore(assessment.classes?.[key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
