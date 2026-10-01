import { ClipboardCheck, Pencil, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GradingActionButtons } from "@/pages/admin/_shared/grading";
import type { ApplicationStatus } from "@/types";

import type { Review, ReviewVote, SubmitVotePayload } from "../types";
import { NotesTextarea } from "./NotesTextarea";
import { VoteBadge } from "./VoteBadge";

interface CompletedReviewEditorProps {
  review: Review;
  applicationStatus: ApplicationStatus;
  submitting: boolean;
  onSave: (
    payload: SubmitVotePayload,
  ) => Promise<{ success: boolean; error?: string }>;
  onEditingChange: (editing: boolean) => void;
}

/**
 * Shows the admin's own completed review and lets them change the vote,
 * travel vote, and notes while the application is still awaiting a decision.
 * Mount with `key={review.id}` so drafts reset when the selection changes.
 */
export const CompletedReviewEditor = memo(function CompletedReviewEditor({
  review,
  applicationStatus,
  submitting,
  onSave,
  onEditingChange,
}: CompletedReviewEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draftVote, setDraftVote] = useState<ReviewVote | null>(review.vote);
  const [draftTravelVote, setDraftTravelVote] = useState<boolean | null>(
    review.travel_vote,
  );
  const [draftNotes, setDraftNotes] = useState(review.notes ?? "");

  const travelRequested = review.travel_status !== "not_requested";
  const canChange = applicationStatus === "submitted";

  const isDirty =
    draftVote !== review.vote ||
    (travelRequested && draftTravelVote !== review.travel_vote) ||
    draftNotes !== (review.notes ?? "");
  const travelVoteMissing = travelRequested && draftTravelVote == null;
  const canSave = isDirty && !!draftVote && !travelVoteMissing && !submitting;

  // If the parent unmounts us mid-edit (selection change, sheet close), make
  // sure it doesn't stay locked in "editing" mode.
  useEffect(() => () => onEditingChange(false), [onEditingChange]);

  // Keep the ⌘J/K/L hints on GradingActionButtons truthful while editing.
  useEffect(() => {
    if (!editing || submitting) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "j") {
        e.preventDefault();
        setDraftVote("reject");
      } else if (e.key === "k") {
        e.preventDefault();
        setDraftVote("waitlist");
      } else if (e.key === "l") {
        e.preventDefault();
        setDraftVote("accept");
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editing, submitting]);

  function startEditing() {
    setDraftVote(review.vote);
    setDraftTravelVote(review.travel_vote);
    setDraftNotes(review.notes ?? "");
    setEditing(true);
    onEditingChange(true);
  }

  function stopEditing() {
    setEditing(false);
    onEditingChange(false);
  }

  async function handleSave() {
    if (!canSave || !draftVote) return;

    const result = await onSave({
      vote: draftVote,
      travel_vote:
        travelRequested && draftTravelVote !== null
          ? draftTravelVote
          : undefined,
      notes: draftNotes || undefined,
    });

    if (result.success) {
      toast.success(`Vote updated: ${draftVote}`);
      stopEditing();
    } else {
      toast.error(result.error ?? "Failed to update vote");
    }
  }

  if (!editing) {
    return (
      <div className="rounded-md border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm text-muted-foreground">Your Review</Label>
          </div>
          {canChange ? (
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={startEditing}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Change vote
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              Decision finalized — this vote can no longer be changed
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <Label className="text-muted-foreground text-xs">Vote</Label>
            <div className="mt-1">
              <VoteBadge vote={review.vote} />
            </div>
          </div>
          {travelRequested && (
            <div>
              <Label className="text-muted-foreground text-xs">
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
          <div className="col-span-2">
            <Label className="text-muted-foreground text-xs">Notes</Label>
            {review.notes ? (
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                {review.notes}
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground italic">No notes</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center gap-1.5">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm text-muted-foreground">
          Change Your Review
        </Label>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Your Notes</Label>
        <NotesTextarea
          reviewId={review.id}
          initialValue={draftNotes}
          disabled={submitting}
          rows={4}
          onNotesChange={(_id, value) => setDraftNotes(value)}
        />
      </div>

      {travelRequested && (
        <div>
          <Label className="text-xs text-muted-foreground">
            Travel Reimbursement
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            This applicant requested travel reimbursement. Should they receive
            it?
          </p>
          <div className="flex gap-2 mt-1.5">
            <Button
              size="sm"
              variant={draftTravelVote === true ? "default" : "outline"}
              className="flex-1 cursor-pointer"
              disabled={submitting}
              onClick={() => setDraftTravelVote(true)}
            >
              <ThumbsUp className="h-3.5 w-3.5 mr-1" />
              Yes
            </Button>
            <Button
              size="sm"
              variant={draftTravelVote === false ? "default" : "outline"}
              className="flex-1 cursor-pointer"
              disabled={submitting}
              onClick={() => setDraftTravelVote(false)}
            >
              <ThumbsDown className="h-3.5 w-3.5 mr-1" />
              No
            </Button>
          </div>
        </div>
      )}

      <GradingActionButtons
        label="Your vote"
        selected={draftVote}
        disabled={submitting}
        onReject={() => setDraftVote("reject")}
        onWaitlist={() => setDraftVote("waitlist")}
        onAccept={() => setDraftVote("accept")}
      />
      {travelVoteMissing && (
        <p className="text-xs text-muted-foreground text-center">
          Cast a travel reimbursement vote before saving
        </p>
      )}

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          disabled={submitting}
          onClick={stopEditing}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="cursor-pointer"
          disabled={!canSave}
          loading={submitting}
          onClick={handleSave}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
});
