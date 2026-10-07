import { Pencil, Sparkles } from "lucide-react";
import { memo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AIAssessmentSummary } from "@/pages/admin/_shared/AIAssessmentSummary";
import { SECTION_TITLE } from "@/pages/admin/_shared/grading";
import {
  AI_CLASS_KEYS,
  AI_CLASS_LABELS,
  EMPTY_AI_ASSESSMENT,
} from "@/shared/lib/ai-assessment";
import type { AIAssessment, AIAssessmentPatch, AIVerdict } from "@/types";

import { calculateAIAssessment, updateAIAssessment } from "../api";

interface AIAssessmentFieldProps {
  applicationId: string;
  assessment: AIAssessment | null;
  onUpdate: (assessment: AIAssessment) => void;
}

type Draft = Record<"ai_score" | AIVerdict, string> & {
  verdict: AIVerdict | "";
};

function toDraft(assessment: AIAssessment): Draft {
  return {
    ai_score: assessment.ai_score?.toString() ?? "",
    verdict: assessment.verdict ?? "",
    human: assessment.classes?.human?.toString() ?? "",
    ai: assessment.classes?.ai?.toString() ?? "",
    ai_edited: assessment.classes?.ai_edited?.toString() ?? "",
    humanized: assessment.classes?.humanized?.toString() ?? "",
  };
}

/** Mount with key={applicationId} so drafts and pending state belong to one applicant. */
export const AIAssessmentField = memo(function AIAssessmentField({
  applicationId,
  assessment,
  onUpdate,
}: AIAssessmentFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(EMPTY_AI_ASSESSMENT));
  const [baseline, setBaseline] = useState(draft);
  const [pending, setPending] = useState<"save" | "calculate" | null>(null);
  const inFlight = useRef(false);
  const disabled = pending !== null || assessment === null;

  function startEditing() {
    const initial = toDraft(assessment ?? EMPTY_AI_ASSESSMENT);
    setDraft(initial);
    setBaseline(initial);
    setEditing(true);
  }

  async function save() {
    if (inFlight.current || !assessment) return;
    const patch: AIAssessmentPatch = {};
    for (const key of ["ai_score", ...AI_CLASS_KEYS] as const) {
      if (draft[key] === baseline[key]) continue;
      const value = draft[key].trim() === "" ? null : Number(draft[key]);
      if (
        value !== null &&
        (!Number.isFinite(value) || value < 0 || value > 1)
      ) {
        toast.error("Scores must be between 0 and 1");
        return;
      }
      if (key === "ai_score") patch.ai_score = value;
      else patch.classes = { ...patch.classes, [key]: value };
    }
    if (draft.verdict !== baseline.verdict)
      patch.verdict = draft.verdict || null;
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    inFlight.current = true;
    setPending("save");
    try {
      const result = await updateAIAssessment(applicationId, patch);
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
    <div className="space-y-4 px-5 py-4" aria-busy={pending !== null}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={SECTION_TITLE}>AI assessment</h3>
        {!editing && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={startEditing}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              loading={pending === "calculate"}
              onClick={() => void calculate()}
            >
              <Sparkles className="size-3.5" />{" "}
              {pending === "calculate" ? "Calculating…" : "Calculate"}
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          <p className="text-xs text-muted-foreground">
            Scores range from 0 to 1. Clear a value to mark it as not set.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>AI score (0–1)</span>
              <Input
                type="number"
                min={0}
                max={1}
                step="any"
                value={draft.ai_score}
                autoFocus
                disabled={disabled}
                onChange={(event) =>
                  setDraft({ ...draft, ai_score: event.target.value })
                }
                className="h-9 tabular-nums"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Verdict</span>
              <select
                value={draft.verdict}
                disabled={disabled}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    verdict: event.target.value as AIVerdict | "",
                  })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">Not set</option>
                {AI_CLASS_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {AI_CLASS_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            {AI_CLASS_KEYS.map((key) => (
              <label
                key={key}
                className="space-y-1 text-xs text-muted-foreground"
              >
                <span>{AI_CLASS_LABELS[key]} (0–1)</span>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step="any"
                  value={draft[key]}
                  disabled={disabled}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.value })
                  }
                  className="h-9 tabular-nums"
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={disabled}
              loading={pending === "save"}
            >
              Save changes
            </Button>
          </div>
        </form>
      ) : assessment ? (
        <>
          <AIAssessmentSummary assessment={assessment} />
          <p className="text-xs text-muted-foreground" role="status">
            {pending === "calculate"
              ? "Analyzing short answers…"
              : "Calculate replaces all values with the detector result."}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Loading assessment…</p>
      )}
    </div>
  );
});
