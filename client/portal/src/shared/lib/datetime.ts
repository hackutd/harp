/**
 * Centralized date/time helpers.
 *
 * The server stores and returns every timestamp as an absolute UTC instant
 * (RFC3339, e.g. "2026-03-14T15:00:00Z"). The client is solely responsible for
 * presentation: it renders those instants in the **viewer's own browser
 * timezone** and surfaces a label (see {@link getLocalTimeZoneLabel}) so the
 * viewer knows which zone they are looking at. Nothing here hardcodes a zone —
 * the native `Date` accessors below always resolve to the browser's local zone.
 */

export interface TimeParts {
  /** Calendar date in the viewer's local timezone, e.g. "2026-03-14". */
  dateKey: string;
  /** Hour of day (0-23) in the viewer's local timezone. */
  hour: number;
  /** Minute of hour (0-59) in the viewer's local timezone. */
  minute: number;
}

/** "YYYY-MM-DD" for a Date's local calendar day. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Breaks an instant into local-timezone calendar/date parts. */
export function getLocalParts(date: Date): TimeParts {
  return {
    dateKey: toDateKey(date),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

/**
 * Parses a date-only value ("YYYY-MM-DD", or the date prefix of an ISO string)
 * into a Date at **local midnight**. Returns null for empty/invalid input.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Local midnight for a Date's calendar day. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "Sat, Mar 14, 2026" style label, or a placeholder when unset. */
export function formatPickerDate(date: Date | null): string {
  if (!date) return "Select date";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export interface LocalTimeZone {
  /** IANA identifier, e.g. "America/Chicago". */
  iana: string;
  /** Short abbreviation for the given date, e.g. "CST" (may be "GMT-6"). */
  abbrev: string;
  /** Ready-to-display label, e.g. "CST · America/Chicago". */
  label: string;
}

/**
 * The viewer's current local timezone, for display alongside a schedule. The
 * abbreviation is DST-aware (resolved for `date`, defaulting to now). When the
 * runtime can't produce a real abbreviation it falls back to the IANA name.
 */
export function getLocalTimeZoneLabel(date: Date = new Date()): LocalTimeZone {
  const iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const abbrev =
    new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "";

  // "CST"/"EST" are meaningful; "GMT-6"/"UTC+5:30" duplicate what the IANA name
  // already conveys, so only pair a real abbreviation with the IANA name.
  const isRealAbbrev = abbrev !== "" && !/^(GMT|UTC)[+-]/i.test(abbrev);
  const label = isRealAbbrev ? `${abbrev} · ${iana}` : iana;

  return { iana, abbrev, label };
}
