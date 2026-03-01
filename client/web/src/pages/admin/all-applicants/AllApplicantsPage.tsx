import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    currentSearch,
    stats,
    statsLoading,
    fetchApplications,
    fetchStats,
  } = useApplicationsStore();

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
    fetchApplications(undefined, controller.signal);
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [fetchApplications, fetchStats]);

  const handleClosePanel = () => {
    setSelectedApplicationId(null);
    clearDetail();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      fetchApplications({ search: searchInput, status: currentStatus });
    }
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="h-9 w-[250px] pl-8"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <StatusFilterTabs
            stats={stats}
            loading={loading}
            currentStatus={currentStatus}
            onStatusChange={handleStatusFilter}
          />
        </div>
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
              {currentSearch && ` matching "${currentSearch}"`}
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
