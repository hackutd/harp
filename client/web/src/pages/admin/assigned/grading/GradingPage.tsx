import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  GradingDetailsPanel,
  GradingPageLayout,
  useGradingKeyboardShortcuts,
} from "@/pages/admin/_shared/grading";
import { formatName } from "@/pages/admin/all-applicants/utils";

import { VoteBadge } from "../components/VoteBadge";
import type { ReviewVote } from "../types";
import { GradingVotingPanel } from "./components/GradingVotingPanel";
import { useAdminGradingStore } from "./store";

export default function GradingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const reviews = useAdminGradingStore((s) => s.reviews);
  const loading = useAdminGradingStore((s) => s.loading);
  const currentIndex = useAdminGradingStore((s) => s.currentIndex);
  const detail = useAdminGradingStore((s) => s.detail);
  const detailLoading = useAdminGradingStore((s) => s.detailLoading);
  const otherNotes = useAdminGradingStore((s) => s.notes);
  const notesLoading = useAdminGradingStore((s) => s.notesLoading);
  const submitting = useAdminGradingStore((s) => s.submitting);
  const localNotes = useAdminGradingStore((s) => s.localNotes);
  const fetchReviews = useAdminGradingStore((s) => s.fetchReviews);
  const loadDetail = useAdminGradingStore((s) => s.loadDetail);
  const navigateNext = useAdminGradingStore((s) => s.navigateNext);
  const navigatePrev = useAdminGradingStore((s) => s.navigatePrev);
  const submitVote = useAdminGradingStore((s) => s.submitVote);
  const setLocalNotes = useAdminGradingStore((s) => s.setLocalNotes);
  const reset = useAdminGradingStore((s) => s.reset);

  const [aiPercent, setAiPercent] = useState<number | null>(null);

  const currentReview = reviews[currentIndex] ?? null;

  // Initialize
  useEffect(() => {
    const targetReviewId = searchParams.get("review");

    reset();
    fetchReviews().then(() => {
      const revs = useAdminGradingStore.getState().reviews;
      if (revs.length > 0) {
        const targetIndex = targetReviewId
          ? revs.findIndex((r) => r.id === targetReviewId)
          : -1;
        const idx = targetIndex >= 0 ? targetIndex : 0;
        useAdminGradingStore.setState({ currentIndex: idx });
        loadDetail(revs[idx].application_id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync AI percent from detail
  useEffect(() => {
    setAiPercent(detail?.ai_percent ?? null);
  }, [detail]);

  const handleVote = useCallback(
    (vote: ReviewVote) => {
      if (currentReview && !submitting && !currentReview.vote) {
        submitVote(currentReview.id, vote);
      }
    },
    [currentReview, submitting, submitVote],
  );

  useGradingKeyboardShortcuts({
    disabled: submitting,
    canAct: !!currentReview?.id && !currentReview?.vote,
    escapeUrl: "/admin/assigned",
    onNavigateNext: navigateNext,
    onNavigatePrev: navigatePrev,
    onActionJ: () => handleVote("reject"),
    onActionK: () => handleVote("waitlist"),
    onActionL: () => handleVote("accept"),
  });

  return (
    <GradingPageLayout
      backUrl="/admin/assigned"
      loading={loading}
      headerContent={
        currentReview ? (
          <>
            <p className="font-semibold">
              {formatName(currentReview.first_name, currentReview.last_name)}
            </p>
            <VoteBadge vote={currentReview.vote} />
          </>
        ) : null
      }
      currentIndex={currentIndex}
      totalCount={reviews.length}
      onNavigateNext={navigateNext}
      onNavigatePrev={navigatePrev}
      canNavigatePrev={!loading && currentIndex > 0}
      canNavigateNext={!loading && currentIndex < reviews.length - 1}
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
            onAiPercentUpdate={setAiPercent}
            onNotesChange={setLocalNotes}
            onVote={handleVote}
          />
        ) : null
      }
      emptyState={
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-muted-foreground">No pending reviews to grade.</p>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => navigate("/admin/assigned")}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Assigned
          </Button>
        </div>
      }
    />
  );
}
