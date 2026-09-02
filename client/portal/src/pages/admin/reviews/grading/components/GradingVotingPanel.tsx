import { Check, Pencil, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { memo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GradingActionButtons,
  ReviewerNotesList,
} from "@/pages/admin/_shared/grading";

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
  travelVote: boolean | null;
  onAiPercentUpdate: (percent: number) => void;
  onNotesChange: (notes: string) => void;
  onTravelVoteChange: (vote: boolean) => void;
  onVote: (vote: ReviewVote) => void;
}

export const GradingVotingPanel = memo(function GradingVotingPanel({
  review,
  notes,
  otherReviewerNotes,
  notesLoading,
  submitting,
  aiPercent,
  travelVote,
  onAiPercentUpdate,
  onNotesChange,
  onTravelVoteChange,
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

  const travelRequested = review.travel_status !== "not_requested";
  const travelVoteMissing =
    travelRequested && !review.vote && travelVote == null;

  return (
    <div className="space-y-4 p-4">
      {/* Other Reviewers' Notes */}
      <ReviewerNotesList notes={otherReviewerNotes} loading={notesLoading} />

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

      {/* Travel Reimbursement Vote — only when the applicant requested travel */}
      {travelRequested && (
        <div>
          <Label className="text-xs text-muted-foreground">
            Travel Reimbursement
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            This applicant requested travel reimbursement. Should they receive
            it?
          </p>
          {review.vote ? (
            <p className="text-sm mt-1.5">
              You voted:{" "}
              <span className="font-medium">
                {review.travel_vote == null
                  ? "—"
                  : review.travel_vote
                    ? "Yes"
                    : "No"}
              </span>
            </p>
          ) : (
            <div className="flex gap-2 mt-1.5">
              <Button
                size="sm"
                variant={travelVote === true ? "default" : "outline"}
                className="flex-1 cursor-pointer"
                disabled={submitting}
                onClick={() => onTravelVoteChange(true)}
              >
                <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                Yes
              </Button>
              <Button
                size="sm"
                variant={travelVote === false ? "default" : "outline"}
                className="flex-1 cursor-pointer"
                disabled={submitting}
                onClick={() => onTravelVoteChange(false)}
              >
                <ThumbsDown className="h-3.5 w-3.5 mr-1" />
                No
              </Button>
            </div>
          )}
        </div>
      )}

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
        <>
          <GradingActionButtons
            disabled={submitting || travelVoteMissing}
            onReject={() => onVote("reject")}
            onWaitlist={() => onVote("waitlist")}
            onAccept={() => onVote("accept")}
          />
          {travelVoteMissing && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Cast a travel reimbursement vote before submitting
            </p>
          )}
          {submitting && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Submitting vote...
            </p>
          )}
        </>
      )}
    </div>
  );
});
