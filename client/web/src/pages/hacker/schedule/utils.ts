import { getLocalParts, parseDateOnly, toDateKey } from "@/shared/lib/datetime";
import type { ScheduleItem } from "@/types";

// Events are stored as UTC instants and rendered in the viewer's local
// timezone, so the schedule places events and the "now" line using the
// browser's local time. The current zone is labeled for the viewer on the page.

export const HOURS_IN_DAY = 24;
export const MINUTES_IN_DAY = HOURS_IN_DAY * 60;

export interface ScheduleDay {
  /** "YYYY-MM-DD" — matches the local dateKey of events on this day. */
  dateKey: string;
  /** Local midnight Date for the calendar day, used only for label formatting. */
  date: Date;
}

/**
 * Every calendar day in the configured hackathon range, inclusive. Returns an
 * empty list when the range is missing or invalid.
 */
export function enumerateDays(
  startKey: string | null,
  endKey: string | null,
): ScheduleDay[] {
  const start = parseDateOnly(startKey);
  const end = parseDateOnly(endKey);
  if (!start || !end || end < start) return [];

  const days: ScheduleDay[] = [];
  // Guard against a pathological range; the backend caps this at 7 days.
  for (
    let cursor = start, guard = 0;
    cursor <= end && guard < 60;
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
    ),
      guard++
  ) {
    days.push({ dateKey: toDateKey(cursor), date: new Date(cursor) });
  }
  return days;
}

export interface DayEvent {
  item: ScheduleItem;
  startMin: number;
  endMin: number;
}

export interface PositionedEvent extends DayEvent {
  /** Horizontal lane within a cluster of overlapping events. */
  lane: number;
  /** Total lanes in this event's overlap cluster. */
  laneCount: number;
}

/**
 * Converts an item to minutes-of-day in local time. Returns null when the item
 * cannot be placed on a single day (invalid or spans midnight backwards).
 */
export function toDayEvent(item: ScheduleItem): {
  dateKey: string;
  event: DayEvent;
} | null {
  const start = new Date(item.start_time);
  const end = new Date(item.end_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const startParts = getLocalParts(start);
  const endParts = getLocalParts(end);

  const startMin = startParts.hour * 60 + startParts.minute;
  let endMin = endParts.hour * 60 + endParts.minute;

  if (endParts.dateKey > startParts.dateKey) {
    // Runs into the next day — clamp to end of this day so it still renders.
    endMin = MINUTES_IN_DAY;
  } else if (endParts.dateKey < startParts.dateKey) {
    return null;
  }

  if (endMin <= startMin) {
    endMin = Math.min(MINUTES_IN_DAY, startMin + 15);
  }

  return { dateKey: startParts.dateKey, event: { item, startMin, endMin } };
}

/**
 * Assigns each event a lane so overlapping events sit side by side. Events that
 * don't overlap anything render full width (laneCount === 1).
 */
export function layoutDayEvents(events: DayEvent[]): PositionedEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
  );

  const result: PositionedEvent[] = [];
  let cluster: DayEvent[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const positioned = cluster.map((event) => {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] > event.startMin) lane++;
      laneEnds[lane] = event.endMin;
      return { event, lane };
    });
    const laneCount = laneEnds.length;
    for (const { event, lane } of positioned) {
      result.push({ ...event, lane, laneCount });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const event of sorted) {
    if (cluster.length > 0 && event.startMin >= clusterEnd) flush();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.endMin);
  }
  flush();

  return result;
}

/** Big display title for the range, e.g. "June" or "Mar – Apr". */
export function formatMonthTitle(days: ScheduleDay[]): string {
  if (days.length === 0) return "";
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const sameMonth =
    first.getMonth() === last.getMonth() &&
    first.getFullYear() === last.getFullYear();
  if (sameMonth) {
    return first.toLocaleDateString("en-US", { month: "long" });
  }
  return `${first.toLocaleDateString("en-US", {
    month: "short",
  })} – ${last.toLocaleDateString("en-US", { month: "short" })}`;
}

/** Splits an hour into a big number and small AM/PM suffix for the axis. */
export function formatHourLabel(hour: number): {
  value: number;
  suffix: string;
} {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const value = normalized % 12 === 0 ? 12 : normalized % 12;
  return { value, suffix };
}

/** Compact "6:45" style label for the now bubble. */
export function formatClock(hour: number, minute: number): string {
  const value = hour % 12 === 0 ? 12 : hour % 12;
  return `${value}:${String(minute).padStart(2, "0")}`;
}
