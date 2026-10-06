import { memo, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  GradingActionButtons,
  ReviewerNotesList,
  SectionHeader,
} from "@/pages/admin/_shared/grading";

import { AIPercentField } from "../../components/AIPercentField";
import { NotesTextarea } from "../../components/NotesTextarea";
import { TravelVoteButtons } from "../../components/TravelVoteButtons";
import { VoteBadge } from "../../components/VoteBadge";
import { useTabToFocusNotes } from "../../hooks/useTabToFocusNotes";
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

  const panelRef = useRef<HTMLDivElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  useTabToFocusNotes(panelRef, notesTextareaRef, canChange && !submitting);

  return (
    <div ref={panelRef} className="divide-y">
      <section aria-label="AI percent">
        <AIPercentField
          key={review.application_id}
          applicationId={review.application_id}
          aiPercent={aiPercent}
          onUpdate={onAiPercentUpdate}
        />
      </section>

      {travelRequested && (
        <section aria-label="Travel reimbursement">
          <SectionHeader
            title="Travel reimbursement"
            aside={canChange ? "Requested" : undefined}
            ruled
          />
          <div className="space-y-3 px-5 py-5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              This applicant requested travel reimbursement. Should they receive
              it?
            </p>
            <TravelVoteButtons
              value={canChange ? travelVote : review.travel_vote}
              disabled={submitting || !canChange}
              onChange={onTravelVoteChange}
            />
          </div>
        </section>
      )}

      <section aria-label="Your vote">
        <SectionHeader
          title="Your vote"
          aside={!canChange ? <VoteBadge vote={review.vote} /> : undefined}
          ruled
        />
        <div className="space-y-4 px-5 py-5">
          {!canChange ? (
            <p className="text-xs text-muted-foreground">
              Decision finalized — this vote can no longer be changed
            </p>
          ) : (
            <>
              <GradingActionButtons
                layout="row"
                label={null}
                selected={vote}
                disabled={submitting}
                onReject={() => onVoteChange("reject")}
                onWaitlist={() => onVoteChange("waitlist")}
                onAccept={() => onVoteChange("accept")}
              />
              {travelVoteMissing && (
                <p className="text-xs text-muted-foreground">
                  Cast a travel reimbursement vote before saving
                </p>
              )}

              <div className="flex items-center justify-end gap-2">
                {isDirty && (
                  <span className="mr-auto text-xs text-muted-foreground">
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
      </section>

      <section aria-label="Your notes">
        <SectionHeader title="Your notes" ruled />
        <div className="px-5 py-5">
          {canChange ? (
            <NotesTextarea
              ref={notesTextareaRef}
              reviewId={review.id}
              initialValue={notes}
              disabled={submitting}
              rows={4}
              onNotesChange={(_id, value) => onNotesChange(value)}
            />
          ) : review.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {review.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes</p>
          )}
        </div>
      </section>

      <section aria-label="Reviewer notes">
        <ReviewerNotesList
          flush
          notes={otherReviewerNotes}
          loading={notesLoading}
        />
      </section>
    </div>
  );
});
