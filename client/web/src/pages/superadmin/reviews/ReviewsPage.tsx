import {
  ArrowDown,
  ClipboardCheck,
  ClipboardList,
  Download,
  Loader2,
  Mail,
  Minus,
  Plus,
  Search,
  Shuffle,
  ToggleRight,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { ApplicationDetailPanel } from "@/pages/admin/all-applicants/components/ApplicationDetailPanel";
import { PaginationControls } from "@/pages/admin/all-applicants/components/PaginationControls";
import { useApplicationDetail } from "@/pages/admin/all-applicants/hooks/useApplicationDetail";
import type {
  ApplicationSortBy,
  ApplicationStatus,
} from "@/pages/admin/all-applicants/types";
import { getStatusColor } from "@/pages/admin/all-applicants/utils";
import type { AssignedState } from "@/pages/admin/assigned/hooks/updateReviewPage";
import { refreshAssignedPage } from "@/pages/admin/assigned/hooks/updateReviewPage";
import { errorAlert, getRequest, postRequest } from "@/shared/lib/api";
import { useUserStore } from "@/shared/stores/user";

import { fetchApplicantEmails } from "./api";
import { ReviewsTable } from "./components/ReviewsTable";
import { ReviewStatusTabs } from "./components/ReviewStatusTabs";
import { useReviewApplicationsStore } from "./store";

export default function ReviewsPage() {
  const navigate = useNavigate();
  const currentUser = useUserStore((s) => s.user);
  const [reviewsPerApp, setReviewsPerApp] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingCount, setSavingCount] = useState(false);

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

  const [emailStatus, setEmailStatus] = useState<ApplicationStatus | null>(
    null,
  );
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    string | null
  >(null);
  const {
    detail: applicationDetail,
    loading: detailLoading,
    clear: clearDetail,
  } = useApplicationDetail(selectedApplicationId);

  useEffect(() => {
    async function fetchData() {
      const [reviewsRes, toggleRes] = await Promise.all([
        getRequest<{ reviews_per_application: number }>(
          "/superadmin/settings/reviews-per-app",
          "reviews per application",
        ),
        getRequest<{
          admins: { id: string; email: string; enabled: boolean }[];
        }>(
          "/superadmin/settings/review-assignment-toggle",
          "fetch review assignment enabled",
        ),
      ]);

      if (reviewsRes.status === 200 && reviewsRes.data) {
        setReviewsPerApp(reviewsRes.data.reviews_per_application);
      }
      if (toggleRes.status === 200 && toggleRes.data) {
        const me = (toggleRes.data.admins ?? []).find(
          (a) => a.id === currentUser?.id,
        );
        setReviewAssignmentEnabled(me?.enabled ?? true);
      }
      setLoading(false);
    }
    fetchData();
  }, [currentUser?.id]);

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

  async function updateReviewsPerApp(newValue: number) {
    const clamped = Math.max(1, Math.min(10, newValue));
    setReviewsPerApp(clamped);
    setSavingCount(true);
    const res = await postRequest<{ reviews_per_application: number }>(
      "/superadmin/settings/reviews-per-app",
      { reviews_per_application: clamped },
      "reviews per application",
    );
    if (res.status === 200 && res.data) {
      setReviewsPerApp(res.data.reviews_per_application);
    } else {
      errorAlert(res);
    }
    setSavingCount(false);
  }

  async function handleBatchAssign() {
    setConfirmOpen(false);
    setAssigning(true);
    const res = await postRequest<{ reviews_created: number }>(
      "/superadmin/applications/assign",
      {},
      "batch assign reviews",
    );
    if (res.status === 200 && res.data) {
      toast.success(
        `Successfully created ${res.data.reviews_created} review assignments`,
      );
    } else {
      errorAlert(res);
    }
    triggerAssignedPageRefresh();
    setAssigning(false);
  }

  async function handleToggleAssignmentEnabled(enabled: boolean) {
    if (!currentUser) return;
    setTogglingAssignment(true);
    const res = await postRequest<{ user_id: string; enabled: boolean }>(
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
    setTogglingAssignment(false);
  }

  async function handleGenerateCsv() {
    if (!emailStatus) return;
    setDownloadingCsv(true);
    const res = await fetchApplicantEmails(emailStatus);
    if (res.status !== 200 || !res.data) {
      errorAlert(res);
      setDownloadingCsv(false);
      return;
    }

    const csvEscape = (value: string | null) => {
      const str = value ?? "";
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = "email,first_name,last_name";
    const rows = res.data.applicants.map(
      (a) =>
        `${csvEscape(a.email)},${csvEscape(a.first_name)},${csvEscape(a.last_name)}`,
    );
    const csv = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${emailStatus}_applicants.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadingCsv(false);
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
                onClick={() => updateReviewsPerApp(reviewsPerApp - 1)}
                disabled={reviewsPerApp <= 1 || savingCount}
                className="size-7 cursor-pointer"
              >
                <Minus className="size-3" />
              </Button>
              <CardTitle className="w-8 text-center text-xl font-semibold tabular-nums">
                {reviewsPerApp}
              </CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateReviewsPerApp(reviewsPerApp + 1)}
                disabled={reviewsPerApp >= 10 || savingCount}
                className="size-7 cursor-pointer"
              >
                <Plus className="size-3" />
              </Button>
              {savingCount && (
                <Loader2 className="ml-1 size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Reviews needed before a decision
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
                disabled={togglingAssignment}
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
              onClick={() => setConfirmOpen(true)}
              disabled={assigning}
              className="w-full cursor-pointer bg-indigo-400"
              size="sm"
            >
              {assigning ? (
                <>
                  <Loader2 className="mr-2 size-3 animate-spin" />
                  Assigning...
                </>
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
        <div className="relative bg-muted rounded-md border p-[2px] w-80">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
          <Input
            placeholder="Search by name or email..."
            className="h-7.5 w-full pl-8 border-none bg-transparent shadow-none placeholder:font-light focus-visible:ring-0 placeholder:text-foreground"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
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
        <Card
          className={`overflow-hidden flex flex-col ${selectedApplicationId ? "w-1/2 rounded-r-none" : "w-full"}`}
        >
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer font-light"
                    >
                      <Mail className="size-3.5" />
                      Grab Emails
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={0}
                    className="w-64 p-3 border"
                  >
                    <p className="text-sm font-normal mb-2">
                      Select status to export
                    </p>
                    <RadioGroup
                      value={emailStatus ?? ""}
                      onValueChange={(value) =>
                        setEmailStatus(value as ApplicationStatus)
                      }
                      className="gap-2"
                    >
                      {(
                        [
                          { key: "accepted", label: "Accepted" },
                          { key: "waitlisted", label: "Waitlisted" },
                          { key: "rejected", label: "Rejected" },
                        ] as const
                      ).map(({ key, label }) => (
                        <label
                          key={key}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value={key} />
                            <span className="text-sm font-light">{label}</span>
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-xs font-light"
                          >
                            {stats?.[key] ?? 0}
                          </Badge>
                        </label>
                      ))}
                    </RadioGroup>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 cursor-pointer font-light"
                      disabled={!emailStatus || downloadingCsv}
                      onClick={handleGenerateCsv}
                    >
                      {downloadingCsv ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      {downloadingCsv ? "Generating..." : "Generate CSV"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      email, first name, last name
                    </p>
                    {stats && stats.submitted > 0 && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-md bg-yellow-50 p-2 text-yellow-800">
                        <TriangleAlert className="size-3.5 shrink-0 mt-0.5" />
                        <p className="text-xs">
                          {stats.submitted} application(s) still in submitted
                          status
                        </p>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardHeader>
          <hr className="border-border -mb-2" />
          <CardContent className="p-0 flex-1 overflow-auto">
            <ReviewsTable
              applications={applications}
              loading={tableLoading}
              selectedId={selectedApplicationId}
              onSelectApplication={setSelectedApplicationId}
              sortBy={currentSortBy ?? "accept_votes"}
              onSortChange={handleSortChange}
            />
          </CardContent>
        </Card>

        {selectedApplicationId && (
          <ApplicationDetailPanel
            application={applicationDetail}
            loading={detailLoading}
            onClose={handleClosePanel}
            onGrade={() => {
              const params = new URLSearchParams();
              if (currentStatus) params.set("status", currentStatus);
              if (currentSortBy) params.set("sort_by", currentSortBy);
              if (currentSearch) params.set("search", currentSearch);
              params.set("app", selectedApplicationId);
              navigate(`/admin/sa/reviews/grade?${params.toString()}`);
            }}
          />
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Batch Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              This will assign admin reviewers to all submitted applications
              that still need reviews. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchAssign}
              className="cursor-pointer bg-indigo-400"
            >
              Yes, Assign Reviews
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
