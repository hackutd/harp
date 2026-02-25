import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ApplicationStats, ApplicationStatus } from "../types";

interface StatusFilterTabsProps {
  stats: ApplicationStats | null;
  loading: boolean;
  currentStatus: ApplicationStatus | null;
  onStatusChange: (status: ApplicationStatus | null) => void;
}

export function StatusFilterTabs({
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
      <TabsList className="h-auto flex-wrap justify-start gap-1 p-1 lg:h-9 lg:flex-nowrap lg:gap-0 lg:p-0.5">
        <TabsTrigger
          value="all"
          disabled={loading}
          className="font-normal cursor-pointer"
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
          className="font-normal cursor-pointer"
        >
          Draft
          {stats && stats.draft > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.draft}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="submitted"
          disabled={loading}
          className="font-normal cursor-pointer"
        >
          Submitted
          {stats && stats.submitted > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.submitted}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="accepted"
          disabled={loading}
          className="font-normal cursor-pointer"
        >
          Accepted
          {stats && stats.accepted > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.accepted}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="waitlisted"
          disabled={loading}
          className="font-normal cursor-pointer"
        >
          Waitlisted
          {stats && stats.waitlisted > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.waitlisted}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="rejected"
          disabled={loading}
          className="font-normal cursor-pointer"
        >
          Rejected
          {stats && stats.rejected > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {stats.rejected}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
