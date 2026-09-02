import { ChevronLeft, ChevronRight, ClipboardPen } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SearchBar } from "@/pages/admin/_shared";
import { ReviewerNotesList } from "@/pages/admin/_shared/grading";
import { fetchApplicationById } from "@/pages/admin/all-applicants/api";
import { ApplicationDetailPanel } from "@/pages/admin/all-applicants/components/ApplicationDetailPanel";
import { useApplicationDetail } from "@/pages/admin/all-applicants/hooks/useApplicationDetail";
import { formatName } from "@/pages/admin/all-applicants/utils";
import { useRedactApplicants } from "@/shared/hooks";
import { errorAlert } from "@/shared/lib/api";
import { formatApplicantLabel, maskEmail } from "@/shared/lib/redaction";

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
  const [searchInput, setSearchInput] = useState("");
  const redact = useRedactApplicants();

  const filteredReviews = (() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) => {
      const first = r.first_name?.toLowerCase() ?? "";
      const last = r.last_name?.toLowerCase() ?? "";
      const full = `${first} ${last}`.trim();
      const email = r.email.toLowerCase();
      return (
        first.includes(q) ||
        last.includes(q) ||
        full.includes(q) ||
        email.includes(q)
      );
    });
  })();

  // Single derived selected review (fixes redundant .find() calls)
  const selectedReview = reviews.find((r) => r.id === selectedId) ?? null;
  const selectedApplicationId = selectedReview?.application_id ?? null;

  const selectedIndex = filteredReviews.findIndex((r) => r.id === selectedId);
  const canPrevious = selectedIndex > 0;
  const canNext =
    selectedIndex !== -1 && selectedIndex < filteredReviews.length - 1;

  const handlePreviousReview = useCallback(() => {
    if (selectedIndex > 0) {
      setSelectedId(filteredReviews[selectedIndex - 1].id);
    }
  }, [filteredReviews, selectedIndex]);

  const handleNextReview = useCallback(() => {
    if (selectedIndex !== -1 && selectedIndex < filteredReviews.length - 1) {
      setSelectedId(filteredReviews[selectedIndex + 1].id);
    }
  }, [filteredReviews, selectedIndex]);

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
      <>{filteredReviews.length} review(s) assigned to you</>
    ) : (
      <>{filteredReviews.length} completed review(s)</>
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
          Grade{" "}
          {redact
            ? formatApplicantLabel(reviews[0].application_id)
            : formatName(reviews[0].first_name, reviews[0].last_name)}
        </TooltipContent>
      </Tooltip>
    ) : undefined;

  // --- Table ---
  const table = (
    <ReviewsTable
      reviews={filteredReviews}
      loading={loading}
      selectedId={selectedId}
      onSelectReview={setSelectedId}
      variant={tab}
    />
  );

  // --- Detail sheets ---
  const detailPanel: React.ReactNode = (
    <>
      <ApplicationDetailPanel
        application={assignedDetail}
        loading={assignedDetailLoading}
        open={tab === "assigned" && !!selectedReview}
        onClose={clearSelection}
        canPrevious={canPrevious}
        canNext={canNext}
        onPrevious={handlePreviousReview}
        onNext={handleNextReview}
        onGrade={() => {
          navigate(`/admin/reviews/grade?review=${selectedId}`);
        }}
      />

      <Sheet
        open={tab === "completed" && !!selectedReview}
        onOpenChange={(isOpen) => !isOpen && clearSelection()}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-3xl">
          <SheetHeader className="border-b px-6 py-4 pr-14">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg">
                  {selectedReview
                    ? redact
                      ? formatApplicantLabel(selectedReview.application_id)
                      : formatName(
                          selectedReview.first_name,
                          selectedReview.last_name,
                        )
                    : "Review"}
                </SheetTitle>
                <SheetDescription className="truncate">
                  {selectedReview
                    ? redact
                      ? maskEmail(selectedReview.email)
                      : selectedReview.email
                    : ""}
                </SheetDescription>
              </div>
              {selectedReview && (
                <div className="shrink-0">
                  <VoteBadge vote={selectedReview.vote} />
                </div>
              )}
            </div>
          </SheetHeader>

          <div className="flex items-center justify-between border-b px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canPrevious}
              onClick={handlePreviousReview}
            >
              <ChevronLeft className="size-4" />
              Previous person
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canNext}
              onClick={handleNextReview}
            >
              Next person
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-6">
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
                completedAppDetail &&
                selectedReview && (
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
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );

  return (
    <div className="flex flex-1 min-h-0">
      <Card className="overflow-hidden flex flex-col h-full w-full">
        <CardHeader className="shrink-0 flex flex-row items-center pb-2 justify-between">
          <div className="flex items-center gap-4">
            <ReviewsTabToggle
              activeTab={tab}
              onTabChange={handleTabChange}
              disabled={loading}
            />
            <CardDescription className="font-light">
              {description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {!redact && (
              <SearchBar value={searchInput} onChange={setSearchInput} />
            )}
            {headerActions}
          </div>
        </CardHeader>
        <hr className="border-border -mb-2" />
        <CardContent className="p-0 flex-1 overflow-hidden">
          {loading && reviews.length === 0 ? (
            <div className="space-y-3 p-6 pt-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            table
          )}
        </CardContent>
      </Card>
      {detailPanel}
    </div>
  );
}
