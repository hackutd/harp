import {
  IconCheck,
  IconPencil,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { memo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AIAssessmentSummary } from "@/pages/admin/_shared/AIAssessmentSummary";
import { SECTION_TITLE } from "@/pages/admin/_shared/grading";
import type { AIAssessment } from "@/types";

import { calculateAIAssessment, updateAIAssessment } from "../api";

interface AIAssessmentFieldProps {
  applicationId: string;
  assessment: AIAssessment | null;
  onUpdate: (assessment: AIAssessment) => void;
}

/** The stored 0–1 score as the percentage a reviewer edits. */
function toPercentDraft(score: number | null | undefined): string {
  return score == null ? "" : Number((score * 100).toFixed(1)).toString();
}

/** Mount with key={applicationId} so drafts and pending state belong to one applicant. */
export const AIAssessmentField = memo(function AIAssessmentField({
  applicationId,
  assessment,
  onUpdate,
}: AIAssessmentFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [baseline, setBaseline] = useState("");
  const [pending, setPending] = useState<"save" | "calculate" | null>(null);
  const inFlight = useRef(false);
  const disabled = pending !== null || assessment === null;

  function startEditing() {
    const initial = toPercentDraft(assessment?.ai_score);
    setDraft(initial);
    setBaseline(initial);
    setEditing(true);
  }

  async function save() {
    if (inFlight.current || !assessment) return;
    if (draft === baseline) {
      setEditing(false);
      return;
    }
    const percent = draft.trim() === "" ? null : Number(draft);
    if (
      percent !== null &&
      (!Number.isFinite(percent) || percent < 0 || percent > 100)
    ) {
      toast.error("AI percent must be between 0 and 100");
      return;
    }

    inFlight.current = true;
    setPending("save");
    try {
      const result = await updateAIAssessment(applicationId, {
        ai_score: percent === null ? null : percent / 100,
      });
      if (result.status === 200 && result.data) {
        onUpdate(result.data);
        setEditing(false);
        toast.success("AI assessment saved");
      } else {
        toast.error(
          result.status === 404
            ? "Only an assigned reviewer can update this assessment"
            : (result.error ?? "Failed to save AI assessment"),
        );
      }
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function calculate() {
    if (inFlight.current || !assessment) return;
    inFlight.current = true;
    setPending("calculate");
    try {
      const result = await calculateAIAssessment(applicationId);
      if (result.status === 200 && result.data) {
        onUpdate(result.data);
        toast.success("AI assessment calculated and saved");
      } else {
        toast.error(
          result.status === 404
            ? "Only an assigned reviewer can calculate this assessment"
            : (result.error ?? "Failed to calculate AI assessment"),
        );
      }
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <div className="space-y-3 px-5 py-4" aria-busy={pending !== null}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={SECTION_TITLE}>AI assessment</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || editing}
              loading={pending === "calculate"}
              onClick={() => void calculate()}
            >
              <IconSparkles className="size-3.5" />{" "}
              {pending === "calculate" ? "Calculating…" : "Calculate"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Overwrites the current AI score</TooltipContent>
        </Tooltip>
      </div>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !disabled) {
              event.stopPropagation();
              setEditing(false);
            }
          }}
          className="text-sm"
        >
          <label
            htmlFor={`ai-score-${applicationId}`}
            className="text-xs text-muted-foreground"
          >
            AI score
          </label>
          <div className="mt-1 flex items-center gap-1">
            <div className="relative">
              <Input
                id={`ai-score-${applicationId}`}
                type="number"
                min={0}
                max={100}
                step="any"
                placeholder="Not set"
                value={draft}
                autoFocus
                disabled={disabled}
                onChange={(event) => setDraft(event.target.value)}
                className="h-8 w-24 pr-6 font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
                %
              </span>
            </div>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label="Save AI score"
              disabled={disabled}
              loading={pending === "save"}
            >
              <IconCheck className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel editing"
              disabled={disabled}
              onClick={() => setEditing(false)}
            >
              <IconX className="size-4" />
            </Button>
          </div>
        </form>
      ) : assessment ? (
        <>
          <AIAssessmentSummary
            assessment={assessment}
            action={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit AI score"
                disabled={disabled}
                onClick={startEditing}
                className="text-muted-foreground"
              >
                <IconPencil className="size-3.5" />
              </Button>
            }
          />
          {pending === "calculate" && (
            <p className="text-xs text-muted-foreground" role="status">
              Analyzing short answers…
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Loading assessment…</p>
      )}
    </div>
  );
});
