import {
  Check,
  Loader2,
  MessageSquare,
  Minus,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { memo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { setAIPercent } from "../../api";
import { NotesTextarea } from "../../components/NotesTextarea";
import { VoteBadge } from "../../components/VoteBadge";
import type { Review, ReviewNote, ReviewVote } from "../../types";

interface GradingVotingPanelProps {
  review: Review;
  notes: string;
  otherReviewerNotes: ReviewNote[];
  notesLoading: boolean;
  submitting: boolean;
  aiPercent: number | null;
  onAiPercentUpdate: (percent: number) => void;
  onNotesChange: (notes: string) => void;
  onVote: (vote: ReviewVote) => void;
}

export const GradingVotingPanel = memo(function GradingVotingPanel({
  review,
  notes,
  otherReviewerNotes,
  notesLoading,
  submitting,
  aiPercent,
  onAiPercentUpdate,
  onNotesChange,
  onVote,
}: GradingVotingPanelProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

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

    const result = await setAIPercent(review.application_id, {
      ai_percent: percent,
    });
    if (result.success) {
      onAiPercentUpdate(percent);
      toast.success("AI percent saved");
    } else {
      toast.error(result.error ?? "Failed to set AI percent");
    }
    setEditing(false);
  }

  return (
    <div className="space-y-4 p-4">
      {/* Other Reviewers' Notes */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm text-muted-foreground">
            Reviewer Notes ({otherReviewerNotes.length})
          </Label>
        </div>
        {notesLoading ? (
          <div className="text-xs text-muted-foreground">Loading notes...</div>
        ) : otherReviewerNotes.length > 0 ? (
          <div className="space-y-2.5">
            {otherReviewerNotes.map((note, idx) => (
              <div
                key={`${note.admin_id}-${idx}`}
                className="bg-white border rounded-md p-3 text-sm"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-muted-foreground">
                    {note.admin_email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {note.notes}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No reviewer notes
          </p>
        )}
      </div>

      {/* Your Notes */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Your Notes</Label>
          {!review.vote && (
            <span className="text-xs text-muted-foreground italic">
              Write notes before casting your vote
            </span>
          )}
        </div>
        <NotesTextarea
          ref={notesTextareaRef}
          reviewId={review.id}
          initialValue={notes}
          disabled={submitting || !!review.vote}
          rows={4}
          onNotesChange={(_id, value) => onNotesChange(value)}
        />
      </div>

      {/* AI Percent */}
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
        ) : aiPercent != null ? (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm">{aiPercent}%</p>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 cursor-pointer"
              onClick={startEditing}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground italic">Not set</p>
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

      {/* Vote Section */}
      {review.vote ? (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">
            You voted: <VoteBadge vote={review.vote} />
          </p>
          {review.reviewed_at && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(review.reviewed_at).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div>
          <Label className="text-xs text-muted-foreground">
            Cast your vote
          </Label>
          <div className="flex flex-col gap-2 mt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full cursor-pointer hover:bg-red-50 hover:text-red-700 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => onVote("reject")}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <ThumbsDown className="h-4 w-4 mr-1.5" />
                  )}
                  Reject
                  <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                    ⌘J
                  </kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reject (⌘J)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full cursor-pointer hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => onVote("waitlist")}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Minus className="h-4 w-4 mr-1.5" />
                  )}
                  Waitlist
                  <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                    ⌘K
                  </kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Waitlist (⌘K)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full cursor-pointer hover:bg-green-50 hover:text-green-700 hover:border-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => onVote("accept")}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <ThumbsUp className="h-4 w-4 mr-1.5" />
                  )}
                  Accept
                  <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                    ⌘L
                  </kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Accept (⌘L)</TooltipContent>
            </Tooltip>
          </div>
          {submitting && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Submitting vote...
            </p>
          )}
        </div>
      )}
    </div>
  );
});
