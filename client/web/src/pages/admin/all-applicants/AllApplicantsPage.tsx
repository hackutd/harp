import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { ApplicationDetailPanel } from "./components/ApplicationDetailPanel";
import { ApplicationsTable } from "./components/ApplicationsTable";
import { PaginationControls } from "./components/PaginationControls";
import { SectionCards } from "./components/SectionCards";
import { StatusFilterTabs } from "./components/StatusFilterTabs";
import { useApplicationDetail } from "./hooks/useApplicationDetail";
import { useApplicationsStore } from "./store";
import type { ApplicationStatus } from "./types";
import { getStatusColor } from "./utils";

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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchApplications({ search: searchInput, status: currentStatus });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, fetchApplications, currentStatus]);

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
      <div className="flex flex-col gap-3 h-full min-h-0">
        {/* Stat cards */}
        <div className="shrink-0 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16 mt-2" />
                <Skeleton className="h-3 w-32 mt-1" />
              </CardHeader>
            </Card>
          ))}
        </div>
        {/* Filter tabs + search row */}
        <div className="shrink-0 grid grid-cols-2 gap-4 lg:grid-cols-4 items-center">
          <div className="col-span-2 flex gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-24 ml-auto rounded-md" />
        </div>
        {/* Table */}
        <Card className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <CardHeader className="shrink-0">
            <Skeleton className="h-4 w-48" />
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
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="shrink-0">
        <SectionCards stats={stats} loading={statsLoading} />
      </div>

      <div className="shrink-0 grid grid-cols-2 gap-4 lg:grid-cols-4 items-center">
        <div className="col-span-2">
          <StatusFilterTabs
            stats={stats}
            loading={loading}
            currentStatus={currentStatus}
            onStatusChange={handleStatusFilter}
          />
        </div>
        <div className="relative bg-muted rounded-md border p-[2px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
          <Input
            placeholder="Search by name or email..."
            className="h-7.5 w-full pl-8 border-none bg-transparent shadow-none placeholder:font-light focus-visible:ring-0 placeholder:text-foreground"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
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
        <Card
          className={`overflow-hidden flex flex-col ${selectedApplicationId ? "w-1/2 rounded-r-none" : "w-full"}`}
        >
          <CardHeader className="shrink-0">
            <CardDescription className="font-light flex items-center gap-1.5">
              <span>{applications.length} application(s) on this page</span>
              {currentStatus && (
                <>
                  <span>filtered by</span>
                  <Badge className={getStatusColor(currentStatus)}>
                    {currentStatus}
                  </Badge>
                </>
              )}
              {currentSearch && <span>matching "{currentSearch}"</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
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
