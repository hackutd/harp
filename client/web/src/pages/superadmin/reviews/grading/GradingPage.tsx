import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ApplicationSortBy,
  ApplicationStatus,
} from "@/pages/admin/all-applicants/types";
import { formatName, getStatusColor } from "@/pages/admin/all-applicants/utils";

import { GradingDetailsPanel } from "./components/GradingDetailsPanel";
import { GradingPanel } from "./components/GradingPanel";
import { useGradingKeyboardShortcuts } from "./hooks/useGradingKeyboardShortcuts";
import { useGradingStore } from "./store";

export default function GradingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const applications = useGradingStore((s) => s.applications);
  const loading = useGradingStore((s) => s.loading);
  const currentIndex = useGradingStore((s) => s.currentIndex);
  const detail = useGradingStore((s) => s.detail);
  const detailLoading = useGradingStore((s) => s.detailLoading);
  const notes = useGradingStore((s) => s.notes);
  const notesLoading = useGradingStore((s) => s.notesLoading);
  const grading = useGradingStore((s) => s.grading);
  const fetchApplications = useGradingStore((s) => s.fetchApplications);
  const loadDetail = useGradingStore((s) => s.loadDetail);
  const navigateNext = useGradingStore((s) => s.navigateNext);
  const navigatePrev = useGradingStore((s) => s.navigatePrev);
  const gradeApplication = useGradingStore((s) => s.gradeApplication);
  const reset = useGradingStore((s) => s.reset);

  const currentApp = applications[currentIndex] ?? null;

  // Initialize from URL params and reset stale state
  useEffect(() => {
    const status =
      (searchParams.get("status") as ApplicationStatus) || "submitted";
    const sort_by =
      (searchParams.get("sort_by") as ApplicationSortBy) || "accept_votes";
    const search = searchParams.get("search") || "";
    const targetAppId = searchParams.get("app");

    reset();
    useGradingStore.setState({
      filterParams: { status, sort_by, search: search || undefined },
    });

    fetchApplications({
      status,
      sort_by,
      search: search || undefined,
    }).then(() => {
      const apps = useGradingStore.getState().applications;
      if (apps.length > 0) {
        const targetIndex = targetAppId
          ? apps.findIndex((a) => a.id === targetAppId)
          : -1;
        const idx = targetIndex >= 0 ? targetIndex : 0;
        useGradingStore.setState({ currentIndex: idx });
        loadDetail(apps[idx].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGrade = useCallback(
    (status: "accepted" | "rejected" | "waitlisted") => {
      if (currentApp) {
        gradeApplication(currentApp.id, status);
      }
    },
    [currentApp, gradeApplication],
  );

  useGradingKeyboardShortcuts({
    grading,
    currentApplicationId: currentApp?.id ?? null,
    onNavigateNext: navigateNext,
    onNavigatePrev: navigatePrev,
    onGrade: handleGrade,
  });

  // Empty state
  if (!loading && applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">
          No applications match the current filters.
        </p>
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={() => navigate("/admin/sa/reviews")}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Reviews
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
          onClick={() => navigate("/admin/sa/reviews")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {loading ? (
          <Skeleton className="h-5 w-40" />
        ) : currentApp ? (
          <>
            <p className="font-semibold">
              {formatName(currentApp.first_name, currentApp.last_name)}
            </p>
            <Badge className={getStatusColor(currentApp.status)}>
              {currentApp.status}
            </Badge>
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={navigatePrev}
            disabled={loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {applications.length > 0
              ? `${currentIndex + 1} of ${applications.length}`
              : "-"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={navigateNext}
            disabled={loading}
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
            listItem={currentApp}
            loading={detailLoading}
          />
        </div>

        {/* Right panel - Grading (25%) */}
        <div className="w-1/4 flex flex-col bg-gray-50/50">
          <div className="flex-1 overflow-auto">
            <GradingPanel
              listItem={currentApp}
              notes={notes}
              notesLoading={notesLoading}
              grading={grading}
              onGrade={handleGrade}
            />
          </div>
          {/* Navigation hint - pinned at bottom */}
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
