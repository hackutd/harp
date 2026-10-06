import { Check, Pencil, X } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div>
      <Label className="text-xs text-muted-foreground">AI Percent</Label>
      {editing ? (
        <div className="flex items-center gap-2 mt-1">
          <Input
            type="number"
            min={0}
            max={100}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="h-7 w-24 text-sm"
            autoFocus
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 cursor-pointer"
            onClick={saveEditing}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 cursor-pointer"
            onClick={cancelEditing}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-1">
          <p
            className={`text-sm ${aiPercent == null ? "text-muted-foreground italic" : ""}`}
          >
            {aiPercent != null ? `${aiPercent}%` : "Not set"}
          </p>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 cursor-pointer"
            onClick={startEditing}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
});
