import { MS_PER_DAY, QUARTER_HOUR_SLOTS } from "./constants";
import type { DragSelection } from "./types";

export function getDateRange(start: Date, end: Date) {
  const days: Date[] = [];
  for (let current = start; current <= end; ) {
    days.push(current);
    current = new Date(current.getTime() + MS_PER_DAY);
  }
  return days;
}

export function formatDayHeader(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatQuarterTime(quarter: number) {
  const safeQuarter = Math.max(0, Math.min(quarter, QUARTER_HOUR_SLOTS));
  const hour24 = Math.floor(safeQuarter / 4);
  const minute = (safeQuarter % 4) * 15;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function buildSelectionBounds(selection: DragSelection) {
  const startQuarter = Math.min(
    selection.startQuarter,
    selection.currentQuarter,
  );
  const endQuarter =
    Math.max(selection.startQuarter, selection.currentQuarter) + 1;
  return { startQuarter, endQuarter };
}

// Builds the event instant from a day column + quarter slot in the admin's
// LOCAL timezone (then serialized with toISOString for the API). This must stay
// local so it round-trips with getLocalParts() when the schedule is read back.
export function dateForQuarter(day: Date, quarter: number) {
  const hour = Math.floor(quarter / 4);
  const minute = (quarter % 4) * 15;
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour,
    minute,
    0,
    0,
  );
}
