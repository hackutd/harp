import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GradingDetailsPanel,
  GradingPageLayout,
  useGradingKeyboardShortcuts,
} from "@/pages/admin/_shared/grading";
import type {
  ApplicationSortBy,
  ApplicationStatus,
} from "@/pages/admin/all-applicants/types";
import { formatName, getStatusColor } from "@/pages/admin/all-applicants/utils";

import { GradingPanel } from "./components/GradingPanel";
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
  const nextCursor = useGradingStore((s) => s.nextCursor);
  const prevCursor = useGradingStore((s) => s.prevCursor);
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
    disabled: grading,
    canAct: !!currentApp?.id,
    escapeUrl: "/admin/sa/reviews",
    onNavigateNext: navigateNext,
    onNavigatePrev: navigatePrev,
    onActionJ: () => handleGrade("rejected"),
    onActionK: () => handleGrade("waitlisted"),
    onActionL: () => handleGrade("accepted"),
  });

  return (
    <GradingPageLayout
      backUrl="/admin/sa/reviews"
      loading={loading}
      headerContent={
        currentApp ? (
          <>
            <p className="font-semibold">
              {formatName(currentApp.first_name, currentApp.last_name)}
            </p>
            <Badge className={getStatusColor(currentApp.status)}>
              {currentApp.status}
            </Badge>
          </>
        ) : null
      }
      currentIndex={currentIndex}
      totalCount={applications.length}
      onNavigateNext={navigateNext}
      onNavigatePrev={navigatePrev}
      canNavigatePrev={!loading && (currentIndex > 0 || !!prevCursor)}
      canNavigateNext={
        !loading && (currentIndex < applications.length - 1 || !!nextCursor)
      }
      detailsPanel={
        <GradingDetailsPanel application={detail} loading={detailLoading}>
          {currentApp && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Review Stats
              </h3>
              <div className="space-y-2">
                <p className="text-sm">
                  {currentApp.reviews_completed} / {currentApp.reviews_assigned}{" "}
                  reviews completed
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-green-100 text-green-800">
                    {currentApp.accept_votes} accept
                  </Badge>
                  <Badge className="bg-red-100 text-red-800">
                    {currentApp.reject_votes} reject
                  </Badge>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    {currentApp.waitlist_votes} waitlist
                  </Badge>
                  {currentApp.ai_percent != null && (
                    <Badge variant="secondary">
                      AI: {currentApp.ai_percent}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </GradingDetailsPanel>
      }
      actionPanel={
        <GradingPanel
          listItem={currentApp}
          notes={notes}
          notesLoading={notesLoading}
          grading={grading}
          onGrade={handleGrade}
        />
      }
      emptyState={
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
      }
    />
  );
}
