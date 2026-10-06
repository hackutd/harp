import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchBar } from "@/pages/admin/_shared";
import { useRedactApplicants } from "@/shared/hooks";
import { usePointsConfigStore } from "@/shared/stores";

import { ApplicationDetailPanel } from "./components/ApplicationDetailPanel";
import { ApplicationsTable } from "./components/ApplicationsTable";
import { AttendanceFilterTabs } from "./components/AttendanceFilterTabs";
import { FilterModeToggle } from "./components/FilterModeToggle";
import { PaginationControls } from "./components/PaginationControls";
import { SectionCards } from "./components/SectionCards";
import { StatusFilterTabs } from "./components/StatusFilterTabs";
import { useApplicationDetail } from "./hooks/useApplicationDetail";
import { useApplicationsStore } from "./store";
import type { ApplicationStatus, AttendanceView, FilterMode } from "./types";
import {
  ATTENDANCE_VIEW_FILTERS,
  ATTENDANCE_VIEW_LABELS,
  attendanceViewOf,
  getStatusColor,
  isAttendanceView,
} from "./utils";

export default function AllApplicantsPage() {
  const applications = useApplicationsStore((s) => s.applications);
  const loading = useApplicationsStore((s) => s.loading);
  const nextCursor = useApplicationsStore((s) => s.nextCursor);
  const prevCursor = useApplicationsStore((s) => s.prevCursor);
  const currentStatus = useApplicationsStore((s) => s.currentStatus);
  const currentRSVPStatus = useApplicationsStore((s) => s.currentRSVPStatus);
  const currentCheckedIn = useApplicationsStore((s) => s.currentCheckedIn);
  const currentSearch = useApplicationsStore((s) => s.currentSearch);
  const stats = useApplicationsStore((s) => s.stats);
  const statsLoading = useApplicationsStore((s) => s.statsLoading);
  const fetchApplications = useApplicationsStore((s) => s.fetchApplications);
  const fetchStats = useApplicationsStore((s) => s.fetchStats);
  const fetchPointsConfig = usePointsConfigStore((s) => s.fetchPointsConfig);
  const redact = useRedactApplicants();
  const currentView = attendanceViewOf(
    currentStatus,
    currentRSVPStatus,
    currentCheckedIn,
  );

  // ?view=no_show (linked from the Forms overview) seeds the first fetch only.
  const [searchParams, setSearchParams] = useSearchParams();
  const [linkedView] = useState(() => {
    const view = searchParams.get("view");
    return isAttendanceView(view) ? view : null;
  });

  // The store outlives the page, so reopen in whichever mode its filters use.
  const [filterMode, setFilterMode] = useState<FilterMode>(() =>
    linkedView || currentView ? "event" : "status",
  );

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
    const controller = new AbortController();
    fetchApplications(
      linkedView ? ATTENDANCE_VIEW_FILTERS[linkedView] : undefined,
      controller.signal,
    );
    fetchStats(controller.signal);
    fetchPointsConfig(controller.signal);
    return () => controller.abort();
  }, [fetchApplications, fetchStats, fetchPointsConfig, linkedView]);

  // Drop the param once read so the URL does not outlive the next tab click.
  useEffect(() => {
    if (!searchParams.has("view")) return;
    setSearchParams(
      (prev) => {
        prev.delete("view");
        return prev;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

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

  // Each mode owns the filters it shows, so neither row can leave a hidden
  // filter behind: status tabs clear the attendance filters, and attendance
  // views set status themselves.
  const handleStatusFilter = useCallback(
    (status: ApplicationStatus | null) => {
      fetchApplications({ status, rsvp_status: null, checked_in: null });
    },
    [fetchApplications],
  );

  const handleViewChange = useCallback(
    (view: AttendanceView | null) => {
      fetchApplications(
        view
          ? ATTENDANCE_VIEW_FILTERS[view]
          : { status: null, rsvp_status: null, checked_in: null },
      );
    },
    [fetchApplications],
  );

  // Switching modes starts the new row from All.
  const handleModeChange = useCallback(
    (mode: FilterMode) => {
      setFilterMode(mode);
      fetchApplications({ status: null, rsvp_status: null, checked_in: null });
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

  const isInitialLoad =
    statsLoading && loading && applications.length === 0 && !searchInput;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="shrink-0">
        <SectionCards stats={stats} loading={statsLoading} />
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <FilterModeToggle
            mode={filterMode}
            disabled={loading}
            onModeChange={handleModeChange}
          />
          <div className="h-5 w-px bg-border shrink-0" />
          {isInitialLoad ? (
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-md" />
              ))}
            </div>
          ) : filterMode === "status" ? (
            <StatusFilterTabs
              stats={stats}
              loading={loading}
              currentStatus={currentStatus}
              onStatusChange={handleStatusFilter}
            />
          ) : (
            <AttendanceFilterTabs
              stats={stats}
              loading={loading}
              currentView={currentView}
              onViewChange={handleViewChange}
            />
          )}
        </div>
        {!redact && (
          <div className="flex items-center gap-3">
            <div className="h-5 w-px bg-border shrink-0" />
            <SearchBar value={searchInput} onChange={setSearchInput} />
          </div>
        )}
        <div className="ml-auto flex">
          <PaginationControls
            prevCursor={prevCursor}
            nextCursor={nextCursor}
            loading={loading}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <Card className="overflow-hidden flex flex-col w-full">
          <CardHeader className="shrink-0">
            <CardDescription className="font-light flex items-center gap-1.5">
              <span>{applications.length} application(s) on this page</span>
              {/* An attendance view implies its status, so it stands alone. */}
              {currentView ? (
                <>
                  <span>filtered by</span>
                  <Badge variant="secondary">
                    {ATTENDANCE_VIEW_LABELS[currentView]}
                  </Badge>
                </>
              ) : (
                currentStatus && (
                  <>
                    <span>filtered by</span>
                    <Badge className={getStatusColor(currentStatus)}>
                      {currentStatus}
                    </Badge>
                  </>
                )
              )}
              {currentSearch && <span>matching "{currentSearch}"</span>}
            </CardDescription>
          </CardHeader>
          <hr className="border-border -mb-2" />
          <CardContent className="p-0 flex-1 overflow-auto">
            <ApplicationsTable
              applications={applications}
              loading={loading}
              selectedId={selectedApplicationId}
              onSelectApplication={setSelectedApplicationId}
            />
          </CardContent>
        </Card>
      </div>

      <ApplicationDetailPanel
        application={applicationDetail}
        loading={detailLoading}
        open={!!selectedApplicationId}
        onClose={handleClosePanel}
        canPrevious={selectedIndex > 0}
        canNext={
          selectedIndex !== -1 && selectedIndex < applications.length - 1
        }
        onPrevious={handlePreviousApplication}
        onNext={handleNextApplication}
      />
    </div>
  );
}
