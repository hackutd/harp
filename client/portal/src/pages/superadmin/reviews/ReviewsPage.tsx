import {
  ArrowDown,
  ClipboardCheck,
  ClipboardList,
  Mail,
  Minus,
  Plus,
  Shuffle,
  ToggleRight,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SearchBar } from "@/pages/admin/_shared";
import { ApplicationDetailPanel } from "@/pages/admin/all-applicants/components/ApplicationDetailPanel";
import { PaginationControls } from "@/pages/admin/all-applicants/components/PaginationControls";
import { useApplicationDetail } from "@/pages/admin/all-applicants/hooks/useApplicationDetail";
import type {
  ApplicationSortBy,
  ApplicationStatus,
} from "@/pages/admin/all-applicants/types";
import { getStatusColor } from "@/pages/admin/all-applicants/utils";
import type { AssignedState } from "@/pages/admin/reviews/hooks/updateReviewPage";
import { refreshAssignedPage } from "@/pages/admin/reviews/hooks/updateReviewPage";
import {
  errorAlert,
  getRequest,
  postRequest,
  putRequest,
} from "@/shared/lib/api";
import { useUserStore } from "@/shared/stores/user";

import type { BatchAssignmentResult } from "./api";
import { ReviewsTable } from "./components/ReviewsTable";
import { ReviewStatusTabs } from "./components/ReviewStatusTabs";
import { SendEmailsDialog } from "./components/SendEmailsDialog";
import { useReviewApplicationsStore } from "./store";

export default function ReviewsPage() {
  const navigate = useNavigate();
  const currentUser = useUserStore((s) => s.user);
  const [reviewsPerApp, setReviewsPerApp] = useState<number | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [lastBatch, setLastBatch] = useState<BatchAssignmentResult | null>(
    null,
  );
  const operationInFlight = useRef(false);
  const settingsRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [savingCount, setSavingCount] = useState(false);
  const [pendingReviewsPerApp, setPendingReviewsPerApp] = useState<
    number | null
  >(null);
  const [countConfirmOpen, setCountConfirmOpen] = useState(false);

  const [assigning, setAssigning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewAssignmentEnabled, setReviewAssignmentEnabled] = useState(true);
  const [togglingAssignment, setTogglingAssignment] = useState(false);

  const triggerAssignedPageRefresh = refreshAssignedPage(
    (state: AssignedState) => state.triggerRefresh,
  );

  // Applications table state
  const applications = useReviewApplicationsStore((s) => s.applications);
  const tableLoading = useReviewApplicationsStore((s) => s.loading);
  const tableError = useReviewApplicationsStore((s) => s.error);
  const statsError = useReviewApplicationsStore((s) => s.statsError);
  const nextCursor = useReviewApplicationsStore((s) => s.nextCursor);
  const prevCursor = useReviewApplicationsStore((s) => s.prevCursor);
  const currentStatus = useReviewApplicationsStore((s) => s.currentStatus);
  const currentSearch = useReviewApplicationsStore((s) => s.currentSearch);
  const currentSortBy = useReviewApplicationsStore((s) => s.currentSortBy);
  const stats = useReviewApplicationsStore((s) => s.stats);
  const fetchApplications = useReviewApplicationsStore(
    (s) => s.fetchApplications,
  );
  const fetchStats = useReviewApplicationsStore((s) => s.fetchStats);

  const [sendEmailsOpen, setSendEmailsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    string | null
  >(null);
  const {
    detail: applicationDetail,
    loading: detailLoading,
    clear: clearDetail,
    refresh: refreshDetail,
    error: detailError,
  } = useApplicationDetail(selectedApplicationId);

  const fetchReviewTarget = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++settingsRequest.current;
    setSettingsLoading(true);
    setSettingsError(null);
    const res = await getRequest<{ reviews_per_application: number }>(
      "/superadmin/settings/reviews-per-app",
      "reviews per application",
      signal,
    );
    if (signal?.aborted || requestId !== settingsRequest.current) return;
    if (res.status === 200 && res.data) {
      setReviewsPerApp(res.data.reviews_per_application);
    } else {
      setSettingsError(
        res.error || "Unable to load the review assignment target.",
      );
    }
    setSettingsLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetchReviewTarget(controller.signal),
      getRequest<{
        users: { id: string; review_assignment_enabled: boolean | null }[];
      }>(
        "/superadmin/users?role=super_admin",
        "fetch review assignment enabled",
        controller.signal,
      ).then((res) => {
        if (controller.signal.aborted) return;
        if (res.status === 200 && res.data) {
          const me = (res.data.users ?? []).find(
            (u) => u.id === currentUser?.id,
          );
          setReviewAssignmentEnabled(me?.review_assignment_enabled ?? true);
        }
      }),
    ]).then(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [currentUser?.id, fetchReviewTarget]);

  // Fetch applications and stats on mount
  useEffect(() => {
    const controller = new AbortController();
    fetchApplications(undefined, controller.signal);
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [fetchApplications, fetchStats]);

  // Debounced search
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchApplications({
        search: searchInput.length >= 2 ? searchInput : "",
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, fetchApplications]);

  const handleClosePanel = useCallback(() => {
    setSelectedApplicationId(null);
    clearDetail();
  }, [clearDetail]);

  const selectedIndex = applications.findIndex(
    (app) => app.id === selectedApplicationId,
  );

  const handlePreviousApplication = useCallback(() => {
    if (selectedIndex > 0) {
      setSelectedApplicationId(applications[selectedIndex - 1].id);
    }
  }, [applications, selectedIndex]);

  const handleNextApplication = useCallback(() => {
    if (selectedIndex !== -1 && selectedIndex < applications.length - 1) {
      setSelectedApplicationId(applications[selectedIndex + 1].id);
    }
  }, [applications, selectedIndex]);

  const handleSortChange = useCallback(
    (newSortBy: ApplicationSortBy) => {
      fetchApplications({ sort_by: newSortBy });
    },
    [fetchApplications],
  );

  const handleStatusFilter = useCallback(
    (status: ApplicationStatus) => {
      fetchApplications({ status });
    },
    [fetchApplications],
  );

  const handleNextPage = useCallback(() => {
    if (nextCursor) {
      fetchApplications({ cursor: nextCursor });
    }
  }, [nextCursor, fetchApplications]);

  const handlePrevPage = useCallback(() => {
    if (prevCursor) {
      fetchApplications({ cursor: prevCursor, direction: "backward" });
    }
  }, [prevCursor, fetchApplications]);

  const targetUnavailable =
    settingsLoading || !!settingsError || reviewsPerApp === null;
  const assignmentBlocked =
    targetUnavailable || savingCount || assigning || togglingAssignment;

  async function refreshReviewData() {
    refreshDetail();
    // No cursor means the first page, with the store's active filters and sort.
    await Promise.all([fetchApplications(), fetchStats()]);
  }

  function requestReviewsPerAppChange(newValue: number) {
    if (
      operationInFlight.current ||
      assignmentBlocked ||
      confirmOpen ||
      countConfirmOpen
    )
      return;
    const clamped = Math.max(1, Math.min(10, newValue));
    if (clamped !== reviewsPerApp) {
      setPendingReviewsPerApp(clamped);
      setCountConfirmOpen(true);
    }
  }

  async function confirmReviewsPerAppChange() {
    if (
      pendingReviewsPerApp === null ||
      !countConfirmOpen ||
      operationInFlight.current ||
      assignmentBlocked ||
      confirmOpen
    )
      return;
    const newValue = pendingReviewsPerApp;
    operationInFlight.current = true;
    setCountConfirmOpen(false);
    setSavingCount(true);
    try {
      const res = await postRequest<{ reviews_per_application: number }>(
        "/superadmin/settings/reviews-per-app",
        { reviews_per_application: Math.max(1, Math.min(10, newValue)) },
        "reviews per application",
      );
      if (res.status === 200 && res.data) {
        setReviewsPerApp(res.data.reviews_per_application);
      } else {
        errorAlert(res);
        // A failed response may follow a committed write. Confirm the saved
        // target before permitting assignment again.
        await fetchReviewTarget();
      }
    } finally {
      operationInFlight.current = false;
      setSavingCount(false);
    }
  }

  async function handleBatchAssign() {
    if (operationInFlight.current || assignmentBlocked || countConfirmOpen)
      return;
    operationInFlight.current = true;
    setConfirmOpen(false);
    setAssigning(true);
    try {
      const res = await postRequest<BatchAssignmentResult>(
        "/superadmin/applications/assign",
        {},
        "batch assign reviews",
      );
      if (res.status === 200 && res.data) {
        setLastBatch(res.data);
        setReviewsPerApp(res.data.reviews_per_application);
        const message = `Created ${res.data.reviews_created} review assignment${res.data.reviews_created === 1 ? "" : "s"}`;
        if (res.data.applications_below_target > 0) {
          toast.warning(
            `${message}; ${res.data.applications_below_target} application${res.data.applications_below_target === 1 ? "" : "s"} still ${res.data.applications_below_target === 1 ? "needs" : "need"} assignments.`,
          );
        } else {
          toast.success(message);
        }
        triggerAssignedPageRefresh();
        await refreshReviewData();
      } else {
        errorAlert(res);
      }
    } finally {
      operationInFlight.current = false;
      setAssigning(false);
    }
  }

  async function handleToggleAssignmentEnabled(enabled: boolean) {
    if (
      !currentUser ||
      operationInFlight.current ||
      assigning ||
      confirmOpen ||
      countConfirmOpen ||
      savingCount
    )
      return;
    operationInFlight.current = true;
    setTogglingAssignment(true);
    const res = await putRequest<{ user_id: string; enabled: boolean }>(
      "/superadmin/settings/review-assignment-toggle",
      { user_id: currentUser.id, enabled },
      "review assignment toggle",
    );
    if (res.status === 200 && res.data) {
      setReviewAssignmentEnabled(res.data.enabled);
      toast.warning(
        `Review assignment ${res.data.enabled ? "enabled. Please run Auto Assign Reviews to give yourself reviews." : "disabled. Please run Auto Assign Reviews to reroute any reviews stuck under you."}`,
        { duration: 5000 },
      );
    } else {
      errorAlert(res);
    }
    operationInFlight.current = false;
    setTogglingAssignment(false);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-2 h-8 w-16 rounded bg-muted" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="shrink-0 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Reviews Per Application */}
        <Card className="@container/card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Reviews Per Application</CardDescription>
              <ClipboardList className="size-5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Decrease review target"
                onClick={() =>
                  reviewsPerApp !== null &&
                  requestReviewsPerAppChange(reviewsPerApp - 1)
                }
                disabled={
                  reviewsPerApp === null ||
                  reviewsPerApp <= 1 ||
                  assignmentBlocked ||
                  confirmOpen ||
                  countConfirmOpen
                }
                className="size-7 cursor-pointer"
              >
                <Minus className="size-3" />
              </Button>
              <CardTitle className="w-8 text-center text-xl font-semibold tabular-nums">
                {reviewsPerApp ?? "—"}
              </CardTitle>
              <Button
                variant="outline"
                size="icon"
                aria-label="Increase review target"
                onClick={() =>
                  reviewsPerApp !== null &&
                  requestReviewsPerAppChange(reviewsPerApp + 1)
                }
                disabled={
                  reviewsPerApp === null ||
                  reviewsPerApp >= 10 ||
                  assignmentBlocked ||
                  confirmOpen ||
                  countConfirmOpen
                }
                className="size-7 cursor-pointer"
              >
                <Plus className="size-3" />
              </Button>
              {savingCount && <Skeleton className="ml-1 size-4 rounded-full" />}
            </div>
            <p className="text-sm text-muted-foreground">
              Assignment target per application. Run Assign Reviews after
              changing it.
            </p>
          </CardHeader>
        </Card>

        {/* Review Assignment Toggle */}
        <Card className="@container/card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Assignment Toggle</CardDescription>
              <ToggleRight className="size-5 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">
                {reviewAssignmentEnabled ? "On" : "Off"}
              </CardTitle>
              <Switch
                checked={reviewAssignmentEnabled}
                onCheckedChange={handleToggleAssignmentEnabled}
                disabled={
                  togglingAssignment ||
                  savingCount ||
                  assigning ||
                  confirmOpen ||
                  countConfirmOpen
                }
                className="cursor-pointer"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {reviewAssignmentEnabled
                ? "You are receiving assignments"
                : "You are skipped during assignment"}
            </p>
          </CardHeader>
        </Card>

        {/* Auto Assign Reviews */}
        <Card className="@container/card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Auto Assign</CardDescription>
              <Shuffle className="size-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl font-semibold">Assign</CardTitle>
            <Button
              onClick={() => {
                if (
                  !operationInFlight.current &&
                  !assignmentBlocked &&
                  !countConfirmOpen
                )
                  setConfirmOpen(true);
              }}
              disabled={assignmentBlocked || countConfirmOpen}
              loading={assigning}
              className="w-full cursor-pointer"
              size="sm"
            >
              {assigning ? (
                <>Assigning...</>
              ) : (
                <>
                  Assign Reviews
                  <Shuffle className="ml-1 size-3" />
                </>
              )}
            </Button>
          </CardHeader>
        </Card>
      </div>

      {settingsError && (
        <div
          className="shrink-0 flex items-center gap-3 rounded-md border p-3"
          role="alert"
        >
          <p className="text-sm">{settingsError}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={settingsLoading}
            onClick={() => void fetchReviewTarget()}
          >
            Retry settings
          </Button>
        </div>
      )}
      {lastBatch && (
        <div className="shrink-0 rounded-md border p-3 text-sm" role="status">
          <p>
            Last assignment run (target {lastBatch.reviews_per_application}):{" "}
            {lastBatch.reviews_created} created; {lastBatch.reviews_removed}{" "}
            assignments released from unavailable reviewers.
          </p>
          {lastBatch.applications_below_target > 0 && (
            <p className="mt-1 text-amber-800">
              {lastBatch.applications_below_target} submitted application
              {lastBatch.applications_below_target === 1 ? "" : "s"} still{" "}
              {lastBatch.applications_below_target === 1 ? "needs" : "need"}{" "}
              {lastBatch.reviews_unfilled} assignment
              {lastBatch.reviews_unfilled === 1 ? "" : "s"} because no
              additional distinct eligible reviewers are available.
            </p>
          )}
        </div>
      )}
      {(tableError || statsError) && (
        <div
          className="shrink-0 flex items-center gap-3 rounded-md border p-3"
          role="alert"
        >
          <p className="text-sm">{tableError || statsError}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={tableLoading}
            onClick={() => void refreshReviewData()}
          >
            Retry refresh
          </Button>
        </div>
      )}

      {/* Applications Table Section */}
      <div className="shrink-0 flex flex-wrap items-center gap-3">
        <div>
          <ReviewStatusTabs
            stats={stats}
            loading={tableLoading}
            currentStatus={currentStatus ?? "submitted"}
            onStatusChange={handleStatusFilter}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-5 w-px bg-border shrink-0" />
          <SearchBar value={searchInput} onChange={setSearchInput} />
        </div>
        <div className="ml-auto flex">
          <PaginationControls
            prevCursor={prevCursor}
            nextCursor={nextCursor}
            loading={tableLoading}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <Card className="overflow-hidden flex flex-col w-full">
          <CardHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <CardDescription className="font-light flex items-center gap-1.5">
                <span>{applications.length} application(s) on this page</span>
                <span>filtered by</span>
                <Badge className={getStatusColor(currentStatus ?? "submitted")}>
                  {currentStatus ?? "submitted"}
                </Badge>
                {currentSearch && <span>matching "{currentSearch}"</span>}
                <span className="text-muted-foreground flex items-center gap-0.5">
                  <ArrowDown className="size-4" />
                  {currentSortBy === "accept_votes"
                    ? "accept votes"
                    : currentSortBy === "reject_votes"
                      ? "reject votes"
                      : currentSortBy === "waitlist_votes"
                        ? "waitlist votes"
                        : "date created"}
                </span>
              </CardDescription>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer font-light"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (currentStatus) params.set("status", currentStatus);
                    if (currentSortBy) params.set("sort_by", currentSortBy);
                    if (currentSearch) params.set("search", currentSearch);
                    navigate(`/admin/sa/reviews/grade?${params.toString()}`);
                  }}
                >
                  <ClipboardCheck className="size-3.5" />
                  Start Grading
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer font-light"
                  onClick={() => setSendEmailsOpen(true)}
                >
                  <Mail className="size-3.5" />
                  Send Emails
                </Button>
              </div>
            </div>
          </CardHeader>
          <hr className="border-border -mb-2" />
          <CardContent className="p-0 flex-1 overflow-auto">
            {!tableError && (
              <ReviewsTable
                reviewsPerApp={reviewsPerApp}
                applications={applications}
                loading={tableLoading}
                selectedId={selectedApplicationId}
                onSelectApplication={setSelectedApplicationId}
                sortBy={currentSortBy ?? "accept_votes"}
                onSortChange={handleSortChange}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ApplicationDetailPanel
        application={applicationDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={refreshDetail}
        open={!!selectedApplicationId}
        onClose={handleClosePanel}
        canPrevious={selectedIndex > 0}
        canNext={
          selectedIndex !== -1 && selectedIndex < applications.length - 1
        }
        onPrevious={handlePreviousApplication}
        onNext={handleNextApplication}
        onGrade={() => {
          if (!selectedApplicationId) return;
          const params = new URLSearchParams();
          if (currentStatus) params.set("status", currentStatus);
          if (currentSortBy) params.set("sort_by", currentSortBy);
          if (currentSearch) params.set("search", currentSearch);
          params.set("app", selectedApplicationId);
          navigate(`/admin/sa/reviews/grade?${params.toString()}`);
        }}
      />

      <SendEmailsDialog
        open={sendEmailsOpen}
        onOpenChange={setSendEmailsOpen}
        stats={stats}
      />

      <AlertDialog open={countConfirmOpen} onOpenChange={setCountConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Reviews Per Application?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change reviews per application from{" "}
              {reviewsPerApp} to {pendingReviewsPerApp}? Run Assign Reviews
              after saving to apply the new target.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReviewsPerAppChange}
              disabled={assignmentBlocked}
              className="cursor-pointer"
            >
              Yes, Change Count
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Batch Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              This will fill submitted applications toward {reviewsPerApp}{" "}
              distinct reviewer assignments each and reroute pending work from
              unavailable reviewers. Existing completed reviews are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchAssign}
              disabled={assignmentBlocked}
              className="cursor-pointer"
            >
              Yes, Assign Reviews
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
