import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ApplicationStats,
  ApplicationStatus,
} from "@/pages/admin/all-applicants/types";

import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES } from "../types";

interface ReviewStatusTabsProps {
  stats: ApplicationStats | null;
  loading: boolean;
  currentStatus: ApplicationStatus;
  onStatusChange: (status: ApplicationStatus) => void;
}

export const ReviewStatusTabs = memo(function ReviewStatusTabs({
  stats,
  loading,
  currentStatus,
  onStatusChange,
}: ReviewStatusTabsProps) {
  return (
    <Tabs
      value={currentStatus}
      onValueChange={(value) => onStatusChange(value as ApplicationStatus)}
      className="min-w-0"
    >
      <TabsList className="h-auto w-auto inline-flex rounded-md border justify-start gap-1 p-1 lg:h-9 lg:gap-0 lg:p-0.5">
        {APPLICATION_STATUSES.map((value) => {
          const count = stats?.[value] ?? 0;
          return (
            <TabsTrigger
              key={value}
              value={value}
              disabled={loading}
              className="font-light text-sm cursor-pointer rounded-sm"
            >
              {APPLICATION_STATUS_LABELS[value]}
              {stats && count > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 px-1.5 py-0 text-xs"
                >
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
});
