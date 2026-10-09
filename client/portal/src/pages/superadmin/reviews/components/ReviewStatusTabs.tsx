import { memo } from "react";

import { FilterTabs } from "@/pages/admin/_shared";
import type {
  ApplicationStats,
  ApplicationStatus,
} from "@/pages/admin/all-applicants/types";

import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES } from "../types";

interface ReviewStatusTabsProps {
  stats: ApplicationStats | null;
  currentStatus: ApplicationStatus;
  onStatusChange: (status: ApplicationStatus) => void;
}

export const ReviewStatusTabs = memo(function ReviewStatusTabs({
  stats,
  currentStatus,
  onStatusChange,
}: ReviewStatusTabsProps) {
  const options = APPLICATION_STATUSES.map((value) => {
    const count = stats?.[value] ?? 0;
    return {
      value,
      label: APPLICATION_STATUS_LABELS[value],
      count: stats && count > 0 ? count : undefined,
    };
  });

  return (
    <FilterTabs
      aria-label="Review status"
      options={options}
      value={currentStatus}
      onValueChange={(value) => onStatusChange(value as ApplicationStatus)}
    />
  );
});
