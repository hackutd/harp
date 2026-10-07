import { ClipboardCheck, Pencil } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AIAssessmentSummary } from "@/pages/admin/_shared/AIAssessmentSummary";
import type { AIAssessment, ApplicationStatus } from "@/types";

import type { Review } from "../types";
import { VoteBadge } from "./VoteBadge";

interface CompletedReviewSummaryProps {
  review: Review;
  applicationStatus: ApplicationStatus;
  assessment: AIAssessment;
  onChangeVote: () => void;
}

/**
 * Shows the admin's own completed review. Changing it happens in the
 * full-screen grading view, which `onChangeVote` opens, and only while the
 * application is still awaiting a decision.
 */
export const CompletedReviewSummary = memo(function CompletedReviewSummary({
  review,
  applicationStatus,
  assessment,
  onChangeVote,
}: CompletedReviewSummaryProps) {
  const travelRequested = review.travel_status !== "not_requested";
  const canChange = applicationStatus === "submitted";

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
            onClick={onChangeVote}
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
        <div className="col-span-2">
          <AIAssessmentSummary assessment={assessment} />
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
});
