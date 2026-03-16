import { ClipboardPen, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReviewerNotesList } from "@/pages/admin/_shared/grading";
import { fetchApplicationById } from "@/pages/admin/all-applicants/api";
import { ApplicationDetailPanel } from "@/pages/admin/all-applicants/components/ApplicationDetailPanel";
import { useApplicationDetail } from "@/pages/admin/all-applicants/hooks/useApplicationDetail";
import { formatName } from "@/pages/admin/all-applicants/utils";
import { errorAlert } from "@/shared/lib/api";

import { fetchReviewNotes as apiFetchReviewNotes } from "./api";
import { ApplicationDetailsPanel } from "./components/ApplicationDetailsPanel";
import { ReviewsTable } from "./components/ReviewsTable";
import { ReviewsTabToggle } from "./components/ReviewsTabToggle";
import { VoteBadge } from "./components/VoteBadge";
import { refreshAssignedPage } from "./hooks/updateReviewPage";
import type { ReviewTab } from "./store";
import { useReviewsStore } from "./store";
import type { ReviewNote } from "./types";

export default function ReviewsPage() {
  const navigate = useNavigate();
  const { tab, reviews, loading, setTab, fetchReviews } = useReviewsStore();
  const refreshKey = refreshAssignedPage((state) => state.refreshKey);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Single derived selected review (fixes redundant .find() calls)
  const selectedReview = reviews.find((r) => r.id === selectedId) ?? null;
  const selectedApplicationId = selectedReview?.application_id ?? null;

  // --- Assigned tab detail (via existing hook) ---
  const assignedApplicationId =
    tab === "assigned" ? selectedApplicationId : null;

  const {
    detail: assignedDetail,
    loading: assignedDetailLoading,
    clear: clearAssignedDetail,
  } = useApplicationDetail(assignedApplicationId);

  // --- Completed tab detail ---
  const completedApplicationId =
    tab === "completed" ? selectedApplicationId : null;

  const [completedAppDetail, setCompletedAppDetail] = useState<
    import("@/types").Application | null
  >(null);
  const [completedDetailLoading, setCompletedDetailLoading] = useState(false);
  const [otherReviewerNotes, setOtherReviewerNotes] = useState<ReviewNote[]>(
    [],
  );

  // Fetch reviews on mount, tab change, and refreshKey
  useEffect(() => {
    const controller = new AbortController();
    fetchReviews(controller.signal);
    return () => controller.abort();
  }, [fetchReviews, refreshKey, tab]);

  // Clear selection on tab switch
  const clearSelection = useCallback(() => {
    setSelectedId(null);
    clearAssignedDetail();
    setCompletedAppDetail(null);
    setCompletedDetailLoading(false);
    setOtherReviewerNotes([]);
  }, [clearAssignedDetail]);

  const handleTabChange = useCallback(
    (newTab: ReviewTab) => {
      clearSelection();
      setTab(newTab);
    },
    [setTab, clearSelection],
  );

  // Fetch completed tab detail when application changes (not on every reviews array change)
  useEffect(() => {
    if (!completedApplicationId) return;

    const controller = new AbortController();

    (async () => {
      setCompletedDetailLoading(true);

      const [appRes, notesRes] = await Promise.all([
        fetchApplicationById(completedApplicationId, controller.signal),
        apiFetchReviewNotes(completedApplicationId),
      ]);

      if (controller.signal.aborted) return;

      if (appRes.status === 200 && appRes.data) {
        setCompletedAppDetail(appRes.data);
      } else {
        errorAlert(appRes);
      }

      if (notesRes.status === 200 && notesRes.data) {
        setOtherReviewerNotes(notesRes.data.notes);
      }

      setCompletedDetailLoading(false);
    })();

    return () => {
      controller.abort();
    };
  }, [completedApplicationId]);

  // Keyboard navigation for completed tab (use ref to avoid re-registering on reviews change)
  const reviewsRef = useRef(reviews);
  useEffect(() => {
    reviewsRef.current = reviews;
  }, [reviews]);

  useEffect(() => {
    if (tab !== "completed") return;

    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const currentReviews = reviewsRef.current;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const currentIndex = currentReviews.findIndex(
          (r) => r.id === selectedId,
        );
        const nextIndex = currentIndex + 1;
        if (nextIndex < currentReviews.length) {
          setSelectedId(currentReviews[nextIndex].id);
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const currentIndex = currentReviews.findIndex(
          (r) => r.id === selectedId,
        );
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
          setSelectedId(currentReviews[prevIndex].id);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tab, selectedId]);

  // --- Descriptions ---
  const description =
    tab === "assigned" ? (
      <>{reviews.length} review(s) assigned to you</>
    ) : (
      <>{reviews.length} completed review(s)</>
    );

  // --- Header actions ---
  const headerActions =
    reviews.length > 0 ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer font-light"
            onClick={() => navigate("/admin/reviews/grade")}
          >
            <ClipboardPen className="h-4 w-4 mr-1.5" />
            Start Grading
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Grade {formatName(reviews[0].first_name, reviews[0].last_name)}
        </TooltipContent>
      </Tooltip>
    ) : undefined;

  // --- Table ---
  const table = (
    <ReviewsTable
      reviews={reviews}
      loading={loading}
      selectedId={selectedId}
      onSelectReview={setSelectedId}
      variant={tab}
    />
  );

  // --- Detail panel ---
  let detailPanel: React.ReactNode = null;

  if (tab === "assigned" && selectedReview) {
    detailPanel = (
      <ApplicationDetailPanel
        application={assignedDetail}
        loading={assignedDetailLoading}
        onClose={clearSelection}
        onGrade={() => {
          navigate(`/admin/reviews/grade?review=${selectedId}`);
        }}
      />
    );
  } else if (tab === "completed" && selectedReview) {
    detailPanel = (
      <Card className="shrink-0 flex flex-col h-full w-1/2 rounded-l-none border-l-0 py-0! gap-0!">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 bg-gray-50 border-b px-4 py-3 rounded-tr-xl">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">
              {formatName(selectedReview.first_name, selectedReview.last_name)}
            </p>
            <VoteBadge vote={selectedReview.vote} />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={clearSelection}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Application details */}
        <CardContent className="flex-1 overflow-auto py-4">
          {completedDetailLoading ? (
            <div className="space-y-6 py-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            completedAppDetail && (
              <>
                <ApplicationDetailsPanel
                  application={completedAppDetail}
                  selectedReview={selectedReview}
                  isExpanded={false}
                />

                {/* Reviewer notes section */}
                <div className="mt-6 border-t pt-4">
                  <ReviewerNotesList
                    notes={otherReviewerNotes}
                    loading={false}
                  />
                </div>
              </>
            )
          )}
        </CardContent>
      </Card>
    );
  }

  // --- Loading state ---
  if (loading && reviews.length === 0) {
    return (
      <div className="flex flex-1 min-h-0">
        <Card className="overflow-hidden flex flex-col h-full w-full">
          <CardHeader className="shrink-0 flex flex-row items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </CardHeader>
          <CardContent className="p-0 flex-1 space-y-3 px-6 pb-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      <Card
        className={`overflow-hidden flex flex-col h-full ${selectedId ? "w-1/2 rounded-r-none" : "w-full"}`}
      >
        <CardHeader className="shrink-0 flex flex-row items-center pb-2 justify-between">
          <div className="flex items-center gap-4">
            <ReviewsTabToggle activeTab={tab} onTabChange={handleTabChange} />
            <CardDescription className="font-light">
              {description}
            </CardDescription>
          </div>
          {headerActions}
        </CardHeader>
        <hr className="border-border -mb-2" />
        <CardContent className="p-0 flex-1 overflow-hidden">
          {table}
        </CardContent>
      </Card>
      {detailPanel}
    </div>
  );
}
