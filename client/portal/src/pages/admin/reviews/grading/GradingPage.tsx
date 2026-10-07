import { ArrowLeft, ListPlus } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/pages/admin/_shared";
import {
  GradingDetailsPanel,
  GradingPageLayout,
  useGradingKeyboardShortcuts,
} from "@/pages/admin/_shared/grading";
import { formatName } from "@/pages/admin/all-applicants/utils";
import { useRedactApplicants } from "@/shared/hooks";
import { formatApplicantLabel } from "@/shared/lib/redaction";
import type { AIAssessment } from "@/types";

import { VoteBadge } from "../components/VoteBadge";
import type { ReviewVote } from "../types";
import { CompletedReviewPanel } from "./components/CompletedReviewPanel";
import { GradingVotingPanel } from "./components/GradingVotingPanel";
import type { GradingMode } from "./store";
import { hasUnsavedChanges, useAdminGradingStore } from "./store";

export default function GradingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode: GradingMode =
    searchParams.get("mode") === "completed" ? "completed" : "pending";

  const reviews = useAdminGradingStore((s) => s.reviews);
  const loading = useAdminGradingStore((s) => s.loading);
  const error = useAdminGradingStore((s) => s.error);
  const currentIndex = useAdminGradingStore((s) => s.currentIndex);
  const detail = useAdminGradingStore((s) => s.detail);
  const detailLoading = useAdminGradingStore((s) => s.detailLoading);
  const otherNotes = useAdminGradingStore((s) => s.notes);
  const notesLoading = useAdminGradingStore((s) => s.notesLoading);
  const submitting = useAdminGradingStore((s) => s.submitting);
  const claiming = useAdminGradingStore((s) => s.claiming);
  const localNotes = useAdminGradingStore((s) => s.localNotes);
  const localTravelVote = useAdminGradingStore((s) => s.localTravelVote);
  const localVote = useAdminGradingStore((s) => s.localVote);
  const isDirty = useAdminGradingStore(hasUnsavedChanges);
  const fetchReviews = useAdminGradingStore((s) => s.fetchReviews);
  const navigateNext = useAdminGradingStore((s) => s.navigateNext);
  const navigatePrev = useAdminGradingStore((s) => s.navigatePrev);
  const submitVote = useAdminGradingStore((s) => s.submitVote);
  const updateVote = useAdminGradingStore((s) => s.updateVote);
  const discardChanges = useAdminGradingStore((s) => s.discardChanges);
  const claimMore = useAdminGradingStore((s) => s.claimMore);
  const setLocalNotes = useAdminGradingStore((s) => s.setLocalNotes);
  const setLocalTravelVote = useAdminGradingStore((s) => s.setLocalTravelVote);
  const setLocalVote = useAdminGradingStore((s) => s.setLocalVote);
  const reset = useAdminGradingStore((s) => s.reset);

  const setAiAssessment = (assessment: AIAssessment) => {
    useAdminGradingStore.setState((state) => ({
      detail:
        state.detail && state.detail.id === detail?.id
          ? { ...state.detail, ...assessment }
          : state.detail,
    }));
  };
  const redact = useRedactApplicants();

  const currentReview = reviews[currentIndex] ?? null;
  const aiAssessment =
    detail?.id === currentReview?.application_id ? detail : null;
  // A completed vote can change only while the application awaits a decision.
  const canChangeVote = detail?.status === "submitted";

  const targetReviewId = searchParams.get("review") ?? undefined;
  useEffect(() => {
    const controller = new AbortController();
    reset();
    void fetchReviews(targetReviewId, controller.signal, mode);
    return () => {
      controller.abort();
      reset();
    };
  }, [fetchReviews, reset, targetReviewId, mode]);

  const handleVote = useCallback(
    (vote: ReviewVote) => {
      if (mode === "completed") {
        if (canChangeVote && !submitting) setLocalVote(vote);
        return;
      }
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
    [
      mode,
      canChangeVote,
      setLocalVote,
      currentReview,
      loading,
      error,
      submitting,
      submitVote,
      localTravelVote,
    ],
  );

  useGradingKeyboardShortcuts({
    disabled: submitting || loading || !!error,
    canAct:
      !!currentReview?.id &&
      (mode === "completed" ? canChangeVote : !currentReview.vote),
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
            <PriorityBadge submittedAt={detail?.submitted_at} />
          </>
        ) : null
      }
      currentIndex={currentIndex}
      totalCount={reviews.length}
      onNavigateNext={navigateNext}
      onNavigatePrev={navigatePrev}
      canNavigatePrev={
        !loading && !error && !submitting && !isDirty && currentIndex > 0
      }
      canNavigateNext={
        !loading &&
        !error &&
        !submitting &&
        !isDirty &&
        currentIndex < reviews.length - 1
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
        currentReview && mode === "completed" ? (
          // Wait for the application so the decision status is known.
          detailLoading ? null : (
            <CompletedReviewPanel
              review={currentReview}
              canChange={canChangeVote}
              isDirty={isDirty}
              notes={localNotes}
              travelVote={localTravelVote}
              vote={localVote}
              otherReviewerNotes={otherNotes}
              notesLoading={notesLoading}
              submitting={submitting}
              aiAssessment={aiAssessment}
              onAiAssessmentUpdate={setAiAssessment}
              onNotesChange={setLocalNotes}
              onTravelVoteChange={setLocalTravelVote}
              onVoteChange={setLocalVote}
              onDiscard={discardChanges}
              onSave={() => void updateVote(currentReview.id)}
            />
          )
        ) : currentReview ? (
          <GradingVotingPanel
            review={currentReview}
            notes={localNotes}
            otherReviewerNotes={otherNotes}
            notesLoading={notesLoading}
            submitting={submitting}
            aiAssessment={aiAssessment}
            travelVote={localTravelVote}
            onAiAssessmentUpdate={setAiAssessment}
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
            {error ||
              (mode === "completed"
                ? "No completed reviews to change."
                : "No pending reviews to grade.")}
          </p>
          {error ? (
            <Button
              onClick={() => void fetchReviews(targetReviewId, undefined, mode)}
            >
              Retry
            </Button>
          ) : mode === "completed" ? null : (
            <Button
              className="cursor-pointer"
              loading={claiming}
              onClick={() => void claimMore()}
            >
              <ListPlus className="h-4 w-4 mr-1.5" />
              Get more reviews
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
