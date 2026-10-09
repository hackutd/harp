import { IconInfoCircle } from "@tabler/icons-react";
import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AI_CLASS_KEYS,
  AI_CLASS_LABELS,
  formatAIScore,
} from "@/shared/lib/ai-assessment";
import type { AIAssessment } from "@/types";

/** Shows the AI score; hovering or focusing it reveals the verdict and class breakdown. */
export function AIAssessmentSummary({
  assessment,
  action,
}: {
  assessment: AIAssessment;
  /** Rendered beside the score, e.g. an edit button. */
  action?: ReactNode;
}) {
  return (
    <div className="text-sm">
      <p className="text-xs text-muted-foreground">AI score</p>
      <div className="mt-1 flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`AI score ${formatAIScore(assessment.ai_score)}, show breakdown`}
              className="inline-flex cursor-help items-center gap-1.5 rounded-sm text-base font-semibold tabular-nums underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {formatAIScore(assessment.ai_score)}
              <IconInfoCircle className="size-3.5 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            className="w-52 px-3 py-2.5"
          >
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-4">
                <dt className="opacity-70">Verdict</dt>
                <dd className="font-medium">
                  {assessment.verdict
                    ? AI_CLASS_LABELS[assessment.verdict]
                    : "Not set"}
                </dd>
              </div>
              <div className="border-t border-background/20" />
              {AI_CLASS_KEYS.map((key) => (
                <div key={key} className="flex justify-between gap-4">
                  <dt className="opacity-70">{AI_CLASS_LABELS[key]}</dt>
                  <dd className="tabular-nums">
                    {formatAIScore(assessment.classes?.[key])}
                  </dd>
                </div>
              ))}
            </dl>
          </TooltipContent>
        </Tooltip>
        {action}
      </div>
    </div>
  );
}
