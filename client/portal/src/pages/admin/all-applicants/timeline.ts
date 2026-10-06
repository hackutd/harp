import type { ApplicationTimelinePoint } from "./types";

export type TimelineRange = "7d" | "30d" | "90d" | "all";

export const TIMELINE_RANGE_DAYS: Record<
  Exclude<TimelineRange, "all">,
  number
> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Date keys are YYYY-MM-DD; doing the arithmetic in UTC sidesteps DST. */
function keyToUTC(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  return utcToKey(keyToUTC(key) + days * DAY_MS);
}

/** Today's calendar date in timeZone, as a YYYY-MM-DD key. */
export function todayKey(timeZone: string, now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The viewer's IANA zone, falling back to UTC if the runtime hides it. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "Sep 3" for a YYYY-MM-DD key, independent of the host zone. */
export function formatDayKey(key: string): string {
  return new Date(keyToUTC(key)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export interface BuildTimelineOptions {
  range: TimelineRange;
  cumulative: boolean;
  /** Today in the timeline's zone; the series always runs up to it. */
  today: string;
}

/**
 * Turns the sparse per-day API rows into a dense, chart-ready series: every
 * day in the window is present (zero when idle), and in cumulative mode each
 * day carries the running total since the first application, so a 7-day
 * window still starts from the real count rather than zero.
 */
export function buildTimelineSeries(
  points: ApplicationTimelinePoint[],
  { range, cumulative, today }: BuildTimelineOptions,
): ApplicationTimelinePoint[] {
  if (points.length === 0) return [];

  const byDate = new Map(points.map((p) => [p.date, p]));
  const first = points[0].date;
  const last = points[points.length - 1].date;
  const end = last > today ? last : today;
  const windowStart =
    range === "all" ? first : addDays(today, -(TIMELINE_RANGE_DAYS[range] - 1));

  // Walk from the earlier of the data start and window start so cumulative
  // totals include activity from before the window.
  const walkStart = first < windowStart ? first : windowStart;
  const series: ApplicationTimelinePoint[] = [];
  let started = 0;
  let submitted = 0;

  for (let day = walkStart; day <= end; day = addDays(day, 1)) {
    const point = byDate.get(day);
    const dayStarted = point?.started ?? 0;
    const daySubmitted = point?.submitted ?? 0;
    started += dayStarted;
    submitted += daySubmitted;

    if (day < windowStart) continue;
    series.push(
      cumulative
        ? { date: day, started, submitted }
        : { date: day, started: dayStarted, submitted: daySubmitted },
    );
  }

  return series;
}

/** Totals over a daily (non-cumulative) series. */
export function sumSeries(series: ApplicationTimelinePoint[]): {
  started: number;
  submitted: number;
} {
  return series.reduce(
    (acc, p) => ({
      started: acc.started + p.started,
      submitted: acc.submitted + p.submitted,
    }),
    { started: 0, submitted: 0 },
  );
}
