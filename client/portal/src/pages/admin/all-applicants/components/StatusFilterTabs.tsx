import { memo } from "react";

import { FilterTabs } from "@/pages/admin/_shared";

import type { ApplicationStats, ApplicationStatus } from "../types";

const STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "accepted", label: "Accepted" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "rejected", label: "Rejected" },
];

interface StatusFilterTabsProps {
  stats: ApplicationStats | null;
  currentStatus: ApplicationStatus | null;
  onStatusChange: (status: ApplicationStatus | null) => void;
}

export const StatusFilterTabs = memo(function StatusFilterTabs({
  stats,
  currentStatus,
  onStatusChange,
}: StatusFilterTabsProps) {
  const options = [
    { value: "all", label: "All", count: stats?.total_applications },
    ...STATUSES.map(({ value, label }) => ({
      value,
      label,
      count: stats?.[value],
    })),
  ];

  return (
    <FilterTabs
      aria-label="Application status"
      options={options}
      value={currentStatus ?? "all"}
      onValueChange={(value) =>
        onStatusChange(value === "all" ? null : (value as ApplicationStatus))
      }
    />
  );
});
