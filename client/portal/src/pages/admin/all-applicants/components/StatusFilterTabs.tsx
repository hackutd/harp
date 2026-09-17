import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ApplicationStats, ApplicationStatus } from "../types";

interface StatusFilterTabsProps {
  stats: ApplicationStats | null;
  loading: boolean;
  currentStatus: ApplicationStatus | null;
  onStatusChange: (status: ApplicationStatus | null) => void;
}

export const StatusFilterTabs = memo(function StatusFilterTabs({
  stats,
  loading,
  currentStatus,
  onStatusChange,
}: StatusFilterTabsProps) {
  const handleValueChange = (value: string) => {
    const status = value === "all" ? null : (value as ApplicationStatus);
    onStatusChange(status);
  };

  return (
    <Tabs
      value={currentStatus ?? "all"}
      onValueChange={handleValueChange}
      className="min-w-0"
    >
      <TabsList className="h-auto grid grid-cols-3 justify-items-stretch gap-1 rounded-md border p-1 w-full lg:h-9 lg:inline-flex lg:w-auto lg:flex-nowrap lg:justify-start lg:gap-0 lg:p-0.5">
        <TabsTrigger
          value="all"
          disabled={loading}
          className="font-light cursor-pointer rounded-sm"
        >
          All
          {stats && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.total_applications}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="draft"
          disabled={loading}
          className="font-light cursor-pointer"
        >
          Draft
          {stats && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.draft}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="submitted"
          disabled={loading}
          className="font-light cursor-pointer"
        >
          Submitted
          {stats && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.submitted}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="accepted"
          disabled={loading}
          className="font-light cursor-pointer"
        >
          Accepted
          {stats && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.accepted}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="waitlisted"
          disabled={loading}
          className="font-light cursor-pointer"
        >
          Waitlisted
          {stats && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.waitlisted}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="rejected"
          disabled={loading}
          className="font-light cursor-pointer"
        >
          Rejected
          {stats && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.rejected}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
});
