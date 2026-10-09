import { IconArrowLeft } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/pages/admin/_shared";
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
import { aiOnlyScore, formatAIScore } from "@/shared/lib/ai-assessment";

import { EditApplicationDialog } from "./components/EditApplicationDialog";
import { GradingPanel } from "./components/GradingPanel";
import { TravelRSVPSection } from "./components/TravelRSVPSection";
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
  const saving = useGradingStore((s) => s.saving);
  const nextCursor = useGradingStore((s) => s.nextCursor);
  const prevCursor = useGradingStore((s) => s.prevCursor);
  const fetchApplications = useGradingStore((s) => s.fetchApplications);
  const loadDetail = useGradingStore((s) => s.loadDetail);
  const navigateNext = useGradingStore((s) => s.navigateNext);
  const navigatePrev = useGradingStore((s) => s.navigatePrev);
  const gradeApplication = useGradingStore((s) => s.gradeApplication);
  const gradeTravel = useGradingStore((s) => s.gradeTravel);
  const resetRSVP = useGradingStore((s) => s.resetRSVP);
  const resetTravelRSVP = useGradingStore((s) => s.resetTravelRSVP);
  const saveResponses = useGradingStore((s) => s.saveResponses);
  const replaceResume = useGradingStore((s) => s.replaceResume);
  const removeResume = useGradingStore((s) => s.removeResume);
  const reset = useGradingStore((s) => s.reset);

  const currentApp = applications[currentIndex] ?? null;

  // Moving an application into or out of draft changes what the hacker can
  // do, so both need an explicit confirmation. The id is captured so the
  // confirm can't land on another app.
  const [pendingStatus, setPendingStatus] = useState<{
    id: string;
    from: ApplicationStatus;
    status: ApplicationStatus;
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Initialize from URL params and reset stale state
  useEffect(() => {
    // "all" is the reviews page's All tab: no status filter.
    const statusParam = searchParams.get("status");
    const status =
      statusParam === "all"
        ? null
        : (statusParam as ApplicationStatus) || "submitted";
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
    (status: ApplicationStatus) => {
      if (!currentApp || currentApp.status === status) return;
      if (status === "draft" || currentApp.status === "draft") {
        setPendingStatus({
          id: currentApp.id,
          from: currentApp.status,
          status,
        });
        return;
      }
      gradeApplication(currentApp.id, status);
    },
    [currentApp, gradeApplication],
  );

  const confirmPendingStatus = useCallback(() => {
    if (pendingStatus) {
      gradeApplication(pendingStatus.id, pendingStatus.status);
    }
    setPendingStatus(null);
  }, [pendingStatus, gradeApplication]);

  const handleSaveResponses = useCallback(
    (responses: Record<string, unknown>) =>
      detail ? saveResponses(detail.id, responses) : Promise.resolve(false),
    [detail, saveResponses],
  );

  const handleReplaceResume = useCallback(
    (file: File) => {
      if (detail) replaceResume(detail.id, file);
    },
    [detail, replaceResume],
  );

  const handleRemoveResume = useCallback(() => {
    if (detail) removeResume(detail.id);
  }, [detail, removeResume]);

  const handleGradeTravel = useCallback(
    (
      travelStatus: "approved" | "rejected" | "pending",
      approvedAmountCents?: number,
    ) => {
      if (currentApp) {
        gradeTravel(currentApp.id, travelStatus, approvedAmountCents);
      }
    },
    [currentApp, gradeTravel],
  );

  const handleResetRSVP = useCallback(() => {
    if (currentApp) {
      resetRSVP(currentApp.id);
    }
  }, [currentApp, resetRSVP]);

  const handleResetTravelRSVP = useCallback(() => {
    if (currentApp) {
      resetTravelRSVP(currentApp.id);
    }
  }, [currentApp, resetTravelRSVP]);

  useGradingKeyboardShortcuts({
    disabled: grading,
    suspended: pendingStatus !== null || editOpen,
    canAct: !!currentApp?.id,
    escapeUrl: "/admin/sa/reviews",
    onNavigateNext: navigateNext,
    onNavigatePrev: navigatePrev,
    onActionJ: () => handleGrade("rejected"),
    onActionK: () => handleGrade("waitlisted"),
    onActionL: () => handleGrade("accepted"),
  });

  return (
    <>
      <GradingPageLayout
        backUrl="/admin/sa/reviews"
        loading={loading}
        headerContent={
          currentApp ? (
            <>
              <p className="font-semibold">
                {formatName(
                  currentApp.first_name,
                  currentApp.last_name,
                  currentApp.email,
                )}
              </p>
              <Badge className={getStatusColor(currentApp.status)}>
                {currentApp.status}
              </Badge>
              <PriorityBadge submittedAt={currentApp.submitted_at} />
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
                    {currentApp.reviews_completed} /{" "}
                    {currentApp.reviews_assigned} reviews completed
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="green">
                      {currentApp.accept_votes} accept
                    </Badge>
                    <Badge variant="red">
                      {currentApp.reject_votes} reject
                    </Badge>
                    <Badge variant="orange">
                      {currentApp.waitlist_votes} waitlist
                    </Badge>
                    {aiOnlyScore(currentApp) != null && (
                      <Badge variant="secondary">
                        AI: {formatAIScore(aiOnlyScore(currentApp))}
                      </Badge>
                    )}
                  </div>
                  {currentApp.travel_status !== "not_requested" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="blue">
                        travel: {currentApp.travel_status}
                      </Badge>
                      <Badge variant="green">
                        {currentApp.travel_yes_votes} travel yes
                      </Badge>
                      <Badge variant="red">
                        {currentApp.travel_no_votes} travel no
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Keyed by application so receipt/schema state resets between applicants */}
            {detail && (
              <TravelRSVPSection key={detail.id} application={detail} />
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
            onEdit={() => setEditOpen(true)}
            onGradeTravel={handleGradeTravel}
            onResetRSVP={handleResetRSVP}
            onResetTravelRSVP={handleResetTravelRSVP}
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
              <IconArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Reviews
            </Button>
          </div>
        }
      />

      <EditApplicationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        application={detail}
        saving={saving}
        onSave={handleSaveResponses}
        onReplaceResume={handleReplaceResume}
        onRemoveResume={handleRemoveResume}
      />

      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            {pendingStatus?.status === "draft" ? (
              <>
                <AlertDialogTitle>
                  Reopen this application as a draft?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The hacker can edit their answers and resume again and has to
                  resubmit. Until they do, it leaves the review queues. Its
                  current status (<strong>{pendingStatus.from}</strong>) is
                  replaced, so grade it again once it comes back. Reviews, RSVP,
                  travel decision, and the original submission time are kept.
                </AlertDialogDescription>
              </>
            ) : (
              <>
                <AlertDialogTitle>
                  This application is still a draft
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The applicant hasn&apos;t submitted it, so it may be
                  incomplete. Marking it{" "}
                  <strong>{pendingStatus?.status}</strong> moves it out of
                  draft, and the applicant can no longer edit or submit it.
                  {pendingStatus?.status !== "submitted" &&
                    " It will also be included in decision emails for that status."}
                </AlertDialogDescription>
              </>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPendingStatus}
              className="cursor-pointer"
            >
              {pendingStatus?.status === "draft"
                ? "Reopen as draft"
                : `Mark as ${pendingStatus?.status}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
