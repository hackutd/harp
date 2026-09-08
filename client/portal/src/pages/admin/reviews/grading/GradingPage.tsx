import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  GradingDetailsPanel,
  GradingPageLayout,
  useGradingKeyboardShortcuts,
} from "@/pages/admin/_shared/grading";
import { formatName } from "@/pages/admin/all-applicants/utils";
import { useRedactApplicants } from "@/shared/hooks";
import { formatApplicantLabel } from "@/shared/lib/redaction";

import { VoteBadge } from "../components/VoteBadge";
import type { ReviewVote } from "../types";
import { GradingVotingPanel } from "./components/GradingVotingPanel";
import { useAdminGradingStore } from "./store";

export default function GradingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const reviews = useAdminGradingStore((s) => s.reviews);
  const loading = useAdminGradingStore((s) => s.loading);
  const error = useAdminGradingStore((s) => s.error);
  const currentIndex = useAdminGradingStore((s) => s.currentIndex);
  const detail = useAdminGradingStore((s) => s.detail);
  const detailLoading = useAdminGradingStore((s) => s.detailLoading);
  const otherNotes = useAdminGradingStore((s) => s.notes);
  const notesLoading = useAdminGradingStore((s) => s.notesLoading);
  const submitting = useAdminGradingStore((s) => s.submitting);
  const localNotes = useAdminGradingStore((s) => s.localNotes);
  const localTravelVote = useAdminGradingStore((s) => s.localTravelVote);
  const fetchReviews = useAdminGradingStore((s) => s.fetchReviews);
  const navigateNext = useAdminGradingStore((s) => s.navigateNext);
  const navigatePrev = useAdminGradingStore((s) => s.navigatePrev);
  const submitVote = useAdminGradingStore((s) => s.submitVote);
  const setLocalNotes = useAdminGradingStore((s) => s.setLocalNotes);
  const setLocalTravelVote = useAdminGradingStore((s) => s.setLocalTravelVote);
  const reset = useAdminGradingStore((s) => s.reset);

  const aiPercent = detail?.ai_percent ?? null;
  const setAiPercent = (percent: number) => {
    useAdminGradingStore.setState((state) => ({
      detail:
        state.detail && state.detail.id === detail?.id
          ? { ...state.detail, ai_percent: percent }
          : state.detail,
    }));
  };
  const redact = useRedactApplicants();

  const currentReview = reviews[currentIndex] ?? null;

  const targetReviewId = searchParams.get("review") ?? undefined;
  useEffect(() => {
    const controller = new AbortController();
    reset();
    void fetchReviews(targetReviewId, controller.signal);
    return () => {
      controller.abort();
      reset();
    };
  }, [fetchReviews, reset, targetReviewId]);

  const handleVote = useCallback(
    (vote: ReviewVote) => {
      if (
        currentReview &&
        !loading &&
        !error &&
        !submitting &&
        !currentReview.vote
      ) {
        // A travel yes/no is required when the applicant requested travel
        if (
          currentReview.travel_status !== "not_requested" &&
          localTravelVote === null
        ) {
          return;
        }
        submitVote(currentReview.id, vote);
      }
    },
    [currentReview, loading, error, submitting, submitVote, localTravelVote],
  );

  useGradingKeyboardShortcuts({
    disabled: submitting || loading || !!error,
    canAct: !!currentReview?.id && !currentReview?.vote,
    escapeUrl: "/admin/reviews",
    onNavigateNext: navigateNext,
    onNavigatePrev: navigatePrev,
    onActionJ: () => handleVote("reject"),
    onActionK: () => handleVote("waitlist"),
    onActionL: () => handleVote("accept"),
  });

  return (
    <GradingPageLayout
      backUrl="/admin/reviews"
      loading={loading}
      headerContent={
        currentReview ? (
          <>
            <p className="font-semibold">
              {redact
                ? formatApplicantLabel(currentReview.application_id)
                : formatName(
                    currentReview.first_name,
                    currentReview.last_name,
                    currentReview.email,
                  )}
            </p>
            <VoteBadge vote={currentReview.vote} />
          </>
        ) : null
      }
      currentIndex={currentIndex}
      totalCount={reviews.length}
      onNavigateNext={navigateNext}
      onNavigatePrev={navigatePrev}
      canNavigatePrev={!loading && !error && !submitting && currentIndex > 0}
      canNavigateNext={
        !loading && !error && !submitting && currentIndex < reviews.length - 1
      }
      detailsPanel={
        <GradingDetailsPanel application={detail} loading={detailLoading}>
          {currentReview && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Review Details
              </h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Application ID</span>
                <span className="font-mono text-xs">
                  {currentReview.application_id}
                </span>
                <span className="text-muted-foreground">Assigned at</span>
                <span>
                  {new Date(currentReview.assigned_at).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </GradingDetailsPanel>
      }
      actionPanel={
        currentReview ? (
          <GradingVotingPanel
            review={currentReview}
            notes={localNotes}
            otherReviewerNotes={otherNotes}
            notesLoading={notesLoading}
            submitting={submitting}
            aiPercent={aiPercent}
            travelVote={localTravelVote}
            onAiPercentUpdate={setAiPercent}
            onNotesChange={setLocalNotes}
            onTravelVoteChange={setLocalTravelVote}
            onVote={handleVote}
          />
        ) : null
      }
      emptyState={
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p
            className="text-muted-foreground"
            role={error ? "alert" : undefined}
          >
            {error || "No pending reviews to grade."}
          </p>
          {error && (
            <Button onClick={() => void fetchReviews(targetReviewId)}>
              Retry
            </Button>
          )}
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => navigate("/admin/reviews")}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Reviews
          </Button>
        </div>
      }
    />
  );
}
