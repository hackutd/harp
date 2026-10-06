import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  loading: boolean;
  currentView: AttendanceView | null;
  onViewChange: (view: AttendanceView | null) => void;
}

export const AttendanceFilterTabs = memo(function AttendanceFilterTabs({
  stats,
  loading,
  currentView,
  onViewChange,
}: AttendanceFilterTabsProps) {
  return (
    <Tabs
      value={currentView ?? "any"}
      onValueChange={(value) =>
        onViewChange(value === "any" ? null : (value as AttendanceView))
      }
      className="min-w-0"
    >
      <TabsList
        aria-label="RSVP and attendance"
        className="h-auto w-auto inline-flex flex-wrap rounded-md border justify-start gap-1 p-1 lg:h-9 lg:flex-nowrap lg:gap-0 lg:p-0.5"
      >
        <TabsTrigger
          value="any"
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
        {VIEWS.map((view) => (
          <TabsTrigger
            key={view}
            value={view}
            disabled={loading}
            className="font-light cursor-pointer"
          >
            {ATTENDANCE_VIEW_LABELS[view]}
            {stats && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                {stats[VIEW_COUNTS[view]]}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
});
