import { memo } from "react";

import { FilterTabs } from "@/pages/admin/_shared";
import type {
  ApplicationStats,
  ApplicationStatus,
} from "@/pages/admin/all-applicants/types";

import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES } from "../types";

interface ReviewStatusTabsProps {
  stats: ApplicationStats | null;
  /** null is the All tab: no status filter. */
  currentStatus: ApplicationStatus | null;
  onStatusChange: (status: ApplicationStatus | null) => void;
}

export const ReviewStatusTabs = memo(function ReviewStatusTabs({
  stats,
  currentStatus,
  onStatusChange,
}: ReviewStatusTabsProps) {
  const total = stats?.total_applications ?? 0;
  const options = [
    { value: "all", label: "All", count: total > 0 ? total : undefined },
    ...APPLICATION_STATUSES.map((value) => {
      const count = stats?.[value] ?? 0;
      return {
        value,
        label: APPLICATION_STATUS_LABELS[value],
        count: stats && count > 0 ? count : undefined,
      };
    }),
  ];

  return (
    <FilterTabs
      aria-label="Review status"
      options={options}
      value={currentStatus ?? "all"}
      onValueChange={(value) =>
        onStatusChange(value === "all" ? null : (value as ApplicationStatus))
      }
    />
  );
});
