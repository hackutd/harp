import { memo, useRef } from "react";

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
  const panelRef = useRef<HTMLDivElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  useTabToFocusNotes(panelRef, notesTextareaRef, !review.vote && !submitting);

  const travelRequested = review.travel_status !== "not_requested";
  const travelVoteMissing =
    travelRequested && !review.vote && travelVote == null;

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

      {/* Travel vote — only when the applicant requested travel */}
      {travelRequested && (
        <section aria-label="Travel reimbursement">
          <SectionHeader
            title="Travel reimbursement"
            aside={
              review.vote
                ? review.travel_vote == null
                  ? "—"
                  : review.travel_vote
                    ? "You voted yes"
                    : "You voted no"
                : "Requested"
            }
            ruled
          />
          <div className="space-y-3 px-5 py-5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              This applicant requested travel reimbursement. Should they receive
              it?
            </p>
            <TravelVoteButtons
              value={review.vote ? review.travel_vote : travelVote}
              disabled={submitting || !!review.vote}
              onChange={onTravelVoteChange}
            />
          </div>
        </section>
      )}

      <section aria-label="Your vote">
        <SectionHeader
          title="Your vote"
          aside={review.vote ? <VoteBadge vote={review.vote} /> : undefined}
          ruled
        />
        <div className="space-y-4 px-5 py-5">
          {review.vote ? (
            review.reviewed_at && (
              <p className="text-xs text-muted-foreground">
                Voted {new Date(review.reviewed_at).toLocaleString()}
              </p>
            )
          ) : (
            <>
              <GradingActionButtons
                layout="row"
                label={null}
                disabled={submitting || travelVoteMissing}
                onReject={() => onVote("reject")}
                onWaitlist={() => onVote("waitlist")}
                onAccept={() => onVote("accept")}
              />
              {travelVoteMissing && (
                <p className="text-xs text-muted-foreground">
                  Cast a travel reimbursement vote before submitting
                </p>
              )}
              {submitting && (
                <p className="text-xs text-muted-foreground">
                  Submitting vote...
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section aria-label="Your notes">
        <SectionHeader
          title="Your notes"
          aside={
            review.vote ? undefined : "Write notes before casting your vote"
          }
          ruled
        />
        <div className="px-5 py-5">
          <NotesTextarea
            ref={notesTextareaRef}
            reviewId={review.id}
            initialValue={notes}
            disabled={submitting || !!review.vote}
            rows={4}
            onNotesChange={(_id, value) => onNotesChange(value)}
          />
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
