import { memo } from "react";

import { FilterTabs } from "@/pages/admin/_shared";

import type { ApplicationStats, AttendanceView } from "../types";
import { ATTENDANCE_VIEW_LABELS } from "../utils";

const VIEW_COUNTS: Record<AttendanceView, keyof ApplicationStats> = {
  rsvp_pending: "rsvp_pending",
  rsvp_confirmed: "rsvp_confirmed",
  rsvp_declined: "rsvp_declined",
  checked_in: "checked_in",
  no_show: "no_shows",
};

const VIEWS = Object.keys(VIEW_COUNTS) as AttendanceView[];

interface AttendanceFilterTabsProps {
  stats: ApplicationStats | null;
  currentView: AttendanceView | null;
  onViewChange: (view: AttendanceView | null) => void;
}

export const AttendanceFilterTabs = memo(function AttendanceFilterTabs({
  stats,
  currentView,
  onViewChange,
}: AttendanceFilterTabsProps) {
  const options = [
    { value: "any", label: "All", count: stats?.total_applications },
    ...VIEWS.map((view) => ({
      value: view,
      label: ATTENDANCE_VIEW_LABELS[view],
      count: stats?.[VIEW_COUNTS[view]],
    })),
  ];

  return (
    <FilterTabs
      aria-label="RSVP and attendance"
      options={options}
      value={currentView ?? "any"}
      onValueChange={(value) =>
        onViewChange(value === "any" ? null : (value as AttendanceView))
      }
    />
  );
});
