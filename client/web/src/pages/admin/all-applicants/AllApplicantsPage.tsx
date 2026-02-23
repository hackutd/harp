import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

import { ApplicationDetailPanel } from "./components/ApplicationDetailPanel";
import { ApplicationsTable } from "./components/ApplicationsTable";
import { PaginationControls } from "./components/PaginationControls";
import { SectionCards } from "./components/SectionCards";
import { StatusFilterTabs } from "./components/StatusFilterTabs";
import { useApplicationDetail } from "./hooks/useApplicationDetail";
import { useApplicationsStore } from "./store";
import type { ApplicationStatus } from "./types";

export default function AllApplicantsPage() {
  const {
    applications,
    loading,
    nextCursor,
    prevCursor,
    currentStatus,
    stats,
    statsLoading,
    fetchApplications,
    fetchStats,
  } = useApplicationsStore();

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
    fetchApplications(undefined, controller.signal);
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [fetchApplications, fetchStats]);

  const handleClosePanel = () => {
    setSelectedApplicationId(null);
    clearDetail();
  };

  const handleStatusFilter = (status: ApplicationStatus | null) => {
    fetchApplications({ status });
  };

  const handleNextPage = () => {
    if (nextCursor) {
      fetchApplications({ cursor: nextCursor });
    }
  };

  const handlePrevPage = () => {
    if (prevCursor) {
      fetchApplications({ cursor: prevCursor, direction: "backward" });
    }
  };

  if (loading && applications.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCards stats={stats} loading={statsLoading} />

      <div className="flex items-center justify-between">
        <StatusFilterTabs
          stats={stats}
          loading={loading}
          currentStatus={currentStatus}
          onStatusChange={handleStatusFilter}
        />
        <PaginationControls
          prevCursor={prevCursor}
          nextCursor={nextCursor}
          loading={loading}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      </div>

      <div className="flex">
        <Card
          className={`overflow-hidden flex flex-col max-h-[calc(100vh-180px)] ${selectedApplicationId ? "w-1/2 rounded-r-none" : "w-full"}`}
        >
          <CardHeader className="shrink-0">
            <CardDescription className="font-light">
              {applications.length} application(s) on this page
              {currentStatus && ` (filtered by ${currentStatus})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ApplicationsTable
              applications={applications}
              loading={loading}
              selectedId={selectedApplicationId}
              onSelectApplication={setSelectedApplicationId}
            />
          </CardContent>
        </Card>

        {selectedApplicationId && (
          <ApplicationDetailPanel
            application={applicationDetail}
            loading={detailLoading}
            onClose={handleClosePanel}
          />
        )}
      </div>
    </div>
  );
}
