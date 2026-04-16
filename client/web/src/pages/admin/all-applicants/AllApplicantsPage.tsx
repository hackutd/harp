import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const applications = useApplicationsStore((s) => s.applications);
  const loading = useApplicationsStore((s) => s.loading);
  const nextCursor = useApplicationsStore((s) => s.nextCursor);
  const prevCursor = useApplicationsStore((s) => s.prevCursor);
  const currentStatus = useApplicationsStore((s) => s.currentStatus);
  const currentSearch = useApplicationsStore((s) => s.currentSearch);
  const stats = useApplicationsStore((s) => s.stats);
  const statsLoading = useApplicationsStore((s) => s.statsLoading);
  const fetchApplications = useApplicationsStore((s) => s.fetchApplications);
  const fetchStats = useApplicationsStore((s) => s.fetchStats);

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

  const handleStatusFilter = useCallback(
    (status: ApplicationStatus | null) => {
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

  const isInitialLoad = loading && applications.length === 0 && !searchInput;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="shrink-0">
        <SectionCards stats={stats} loading={statsLoading || isInitialLoad} />
      </div>

      <div className="shrink-0 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3 xl:flex-1">
          <div className="min-w-0 lg:flex-[0_1_auto]">
            {isInitialLoad ? (
              <div className="flex gap-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-20 rounded-md" />
                ))}
              </div>
            ) : (
              <StatusFilterTabs
                stats={stats}
                loading={loading}
                currentStatus={currentStatus}
                onStatusChange={handleStatusFilter}
              />
            )}
          </div>
          <div className="w-full lg:w-[18rem] lg:flex-none lg:border-l lg:border-gray-300 lg:pl-3">
            <div className="group relative w-full after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-center after:scale-x-0 after:bg-foreground after:opacity-0 after:transition-all after:duration-300 after:ease-out focus-within:after:scale-x-100 focus-within:after:opacity-100">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-colors duration-300 ease-out group-focus-within:text-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="h-9 w-full rounded-none border-0 bg-transparent px-0 py-0 pl-7 text-[15px] shadow-none transition-[color,opacity] duration-300 ease-out placeholder:font-light placeholder:text-gray-500 focus-visible:ring-0 focus-visible:outline-none group-focus-within:placeholder:text-gray-400"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end xl:shrink-0">
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
