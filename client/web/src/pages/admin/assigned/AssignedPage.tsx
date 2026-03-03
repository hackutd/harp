import { ClipboardPen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { ApplicationDetailPanel } from "@/pages/admin/all-applicants/components/ApplicationDetailPanel";
import { useApplicationDetail } from "@/pages/admin/all-applicants/hooks/useApplicationDetail";
import { formatName } from "@/pages/admin/all-applicants/utils";

import { ReviewsTable } from "./components/ReviewsTable";
import { refreshAssignedPage } from "./hooks/updateReviewPage";
import { useReviewsStore } from "./store";

export default function AssignedPage() {
  const navigate = useNavigate();
  const { reviews, loading, fetchPendingReviews } = useReviewsStore();
  const refreshKey = refreshAssignedPage((state) => state.refreshKey);

  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  // Map selected review ID to its application_id for the detail hook
  const selectedReview = reviews.find((r) => r.id === selectedReviewId) ?? null;
  const selectedApplicationId = selectedReview?.application_id ?? null;

  const {
    detail: applicationDetail,
    loading: detailLoading,
    clear: clearDetail,
  } = useApplicationDetail(selectedApplicationId);

  useEffect(() => {
    const controller = new AbortController();
    fetchPendingReviews(controller.signal);
    return () => controller.abort();
  }, [fetchPendingReviews, refreshKey]);

  const handleClosePanel = useCallback(() => {
    setSelectedReviewId(null);
    clearDetail();
  }, [clearDetail]);

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
        className={`overflow-hidden flex flex-col h-full ${selectedReviewId ? "w-1/2 rounded-r-none" : "w-full"}`}
      >
        <CardHeader className="shrink-0 flex flex-row items-center pb-2 justify-between">
          <CardDescription className="font-light">
            {reviews.length} review(s) assigned to you
          </CardDescription>
          {reviews.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer font-light"
                  onClick={() => navigate("/admin/assigned/grade")}
                >
                  <ClipboardPen className="h-4 w-4 mr-1.5" />
                  Start Grading
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Grade {formatName(reviews[0].first_name, reviews[0].last_name)}
              </TooltipContent>
            </Tooltip>
          )}
        </CardHeader>
        <hr className="border-border -mb-2" />
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ReviewsTable
            reviews={reviews}
            loading={loading}
            selectedId={selectedReviewId}
            onSelectReview={setSelectedReviewId}
          />
        </CardContent>
      </Card>

      {selectedReviewId && (
        <ApplicationDetailPanel
          application={applicationDetail}
          loading={detailLoading}
          onClose={handleClosePanel}
          onGrade={() => {
            navigate(`/admin/assigned/grade?review=${selectedReviewId}`);
          }}
        />
      )}
    </div>
  );
}
