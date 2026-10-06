import { Check, Pencil, X } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SECTION_TITLE } from "@/pages/admin/_shared/grading";

import { setAIPercent } from "../api";

interface AIPercentFieldProps {
  applicationId: string;
  aiPercent: number | null;
  onUpdate: (percent: number) => void;
}

/**
 * Shows the application's AI percent with an inline editor. Mount with
 * `key={applicationId}` so an open edit resets when the applicant changes.
 */
export const AIPercentField = memo(function AIPercentField({
  applicationId,
  aiPercent,
  onUpdate,
}: AIPercentFieldProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  function startEditing() {
    setInputValue(aiPercent?.toString() ?? "");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  async function saveEditing() {
    const trimmed = inputValue.trim();
    if (trimmed === "") {
      toast.error("AI percentage is required");
      return;
    }
    const percent = Number(trimmed);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      toast.error("AI percent must be a whole number between 0 and 100");
      return;
    }

    const result = await setAIPercent(applicationId, {
      ai_percent: percent,
    });
    if (result.success) {
      onUpdate(percent);
      toast.success("AI percent saved");
    } else {
      toast.error(result.error ?? "Failed to set AI percent");
    }
    setEditing(false);
  }

  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-5 py-3">
      <h3 className={SECTION_TITLE}>AI percent</h3>
      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={100}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="h-8 w-20 text-sm tabular-nums"
            aria-label="AI percent"
            autoFocus
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 cursor-pointer"
            aria-label="Save AI percent"
            onClick={saveEditing}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 cursor-pointer"
            aria-label="Cancel"
            onClick={cancelEditing}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {aiPercent != null ? (
            <span className="border px-2.5 py-1 text-sm tabular-nums">
              AI {aiPercent}%
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not set</span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 cursor-pointer text-muted-foreground"
            aria-label="Edit AI percent"
            onClick={startEditing}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
});
