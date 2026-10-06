import { ThumbsDown, ThumbsUp } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  GradingActionButtons,
  ReviewerNotesList,
} from "@/pages/admin/_shared/grading";

import { AIPercentField } from "../../components/AIPercentField";
import { NotesTextarea } from "../../components/NotesTextarea";
import { VoteBadge } from "../../components/VoteBadge";
import type { Review, ReviewNote, ReviewVote } from "../../types";

interface CompletedReviewPanelProps {
  review: Review;
  /** False once the application has a decision; the vote is then read-only. */
  canChange: boolean;
  isDirty: boolean;
  notes: string;
  travelVote: boolean | null;
  vote: ReviewVote | null;
  otherReviewerNotes: ReviewNote[];
  notesLoading: boolean;
  submitting: boolean;
  aiPercent: number | null;
  onAiPercentUpdate: (percent: number) => void;
  onNotesChange: (notes: string) => void;
  onTravelVoteChange: (vote: boolean) => void;
  onVoteChange: (vote: ReviewVote) => void;
  onDiscard: () => void;
  onSave: () => void;
}

/**
 * Right-hand panel of the full-screen grading view when changing a vote the
 * admin already cast. Edits are drafts until saved.
 */
export const CompletedReviewPanel = memo(function CompletedReviewPanel({
  review,
  canChange,
  isDirty,
  notes,
  travelVote,
  vote,
  otherReviewerNotes,
  notesLoading,
  submitting,
  aiPercent,
  onAiPercentUpdate,
  onNotesChange,
  onTravelVoteChange,
  onVoteChange,
  onDiscard,
  onSave,
}: CompletedReviewPanelProps) {
  const travelRequested = review.travel_status !== "not_requested";
  const travelVoteMissing = travelRequested && travelVote == null;
  const canSave = isDirty && !!vote && !travelVoteMissing && !submitting;

  return (
    <div className="space-y-4 p-4">
      <ReviewerNotesList notes={otherReviewerNotes} loading={notesLoading} />

      <AIPercentField
        key={review.application_id}
        applicationId={review.application_id}
        aiPercent={aiPercent}
        onUpdate={onAiPercentUpdate}
      />

      {!canChange ? (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground italic">
            Decision finalized — this vote can no longer be changed
          </p>
          <div>
            <Label className="text-xs text-muted-foreground">Your Vote</Label>
            <div className="mt-1">
              <VoteBadge vote={review.vote} />
            </div>
          </div>
          {travelRequested && (
            <div>
              <Label className="text-xs text-muted-foreground">
                Travel Reimbursement
              </Label>
              <p className="mt-1">
                {review.travel_vote == null
                  ? "—"
                  : review.travel_vote
                    ? "Yes"
                    : "No"}
              </p>
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">Your Notes</Label>
            {review.notes ? (
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                {review.notes}
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground italic">No notes</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div>
            <Label className="text-xs text-muted-foreground">Your Notes</Label>
            <NotesTextarea
              reviewId={review.id}
              initialValue={notes}
              disabled={submitting}
              rows={4}
              onNotesChange={(_id, value) => onNotesChange(value)}
            />
          </div>

          {travelRequested && (
            <div>
              <Label className="text-xs text-muted-foreground">
                Travel Reimbursement
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                This applicant requested travel reimbursement. Should they
                receive it?
              </p>
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
            </div>
          )}

          <GradingActionButtons
            label="Your vote"
            selected={vote}
            disabled={submitting}
            onReject={() => onVoteChange("reject")}
            onWaitlist={() => onVoteChange("waitlist")}
            onAccept={() => onVoteChange("accept")}
          />
          {travelVoteMissing && (
            <p className="text-xs text-muted-foreground text-center">
              Cast a travel reimbursement vote before saving
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t pt-3">
            {isDirty && (
              <span className="mr-auto text-xs text-muted-foreground italic">
                Save or discard to move to another applicant
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              disabled={!isDirty || submitting}
              onClick={onDiscard}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="cursor-pointer"
              disabled={!canSave}
              loading={submitting}
              onClick={onSave}
            >
              Save changes
            </Button>
          </div>
        </>
      )}
    </div>
  );
});
