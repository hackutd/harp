import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { VoteBadge } from "../components/VoteBadge";
import type { ReviewVote } from "../types";
import { GradingDetailsPanel } from "./components/GradingDetailsPanel";
import { GradingVotingPanel } from "./components/GradingVotingPanel";
import { useGradingKeyboardShortcuts } from "./hooks/useGradingKeyboardShortcuts";
import { useAdminGradingStore } from "./store";

function formatName(firstName: string | null, lastName: string | null) {
  if (!firstName && !lastName) return "-";
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

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
    submitting,
    currentReviewId: currentReview?.id ?? null,
    hasVoted: !!currentReview?.vote,
    onNavigateNext: navigateNext,
    onNavigatePrev: navigatePrev,
    onVote: handleVote,
  });

  // Empty state
  if (!loading && reviews.length === 0) {
    return (
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
    );
  }

  return (
    <div className="-m-4 flex flex-col h-[calc(100%+2rem)] min-h-0">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 bg-gray-50 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="cursor-pointer"
          onClick={() => navigate("/admin/assigned")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {loading ? (
          <Skeleton className="h-5 w-40" />
        ) : currentReview ? (
          <>
            <p className="font-semibold">
              {formatName(currentReview.first_name, currentReview.last_name)}
            </p>
            <VoteBadge vote={currentReview.vote} />
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={navigatePrev}
            disabled={loading || currentIndex <= 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {reviews.length > 0
              ? `${currentIndex + 1} of ${reviews.length}`
              : "-"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={navigateNext}
            disabled={loading || currentIndex >= reviews.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel - Application details (75%) */}
        <div className="w-3/4 overflow-auto border-r">
          <GradingDetailsPanel
            application={detail}
            review={currentReview}
            loading={detailLoading}
          />
        </div>

        {/* Right panel - Voting (25%) */}
        <div className="w-1/4 flex flex-col bg-gray-50/50">
          <div className="flex-1 overflow-auto">
            {currentReview && (
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
            )}
          </div>
          {/* Navigation hint */}
          <div className="shrink-0 border-t bg-gray-50 p-4 pt-2">
            <p className="text-xs text-muted-foreground text-center mt-2">
              Use{" "}
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
                ←
              </kbd>{" "}
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
                →
              </kbd>{" "}
              arrow keys to navigate &middot; Esc to go back
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
