const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** A datetime-local value ("YYYY-MM-DDTHH:mm") for an instant, in the browser's time zone. */
export function toDeadlineInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * An ISO 8601 timestamp in the browser's own offset, e.g.
 * "2026-10-03T23:59:59.999-05:00", so the stored value reads in the
 * organizer's time zone rather than UTC.
 */
export function toOffsetISOString(d: Date): string {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/**
 * The deadline for a datetime-local value. The input has minute precision and
 * "by 11:59 PM" includes the whole of that minute, so the deadline is its last
 * millisecond. Returns null for an empty or unparseable value.
 */
export function fromDeadlineInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setSeconds(59, 999);
  return toOffsetISOString(d);
}

/** The browser's time zone, named for the label beside the input. */
export function browserTimeZoneLabel(at: Date = new Date()): string {
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const abbreviation = new Intl.DateTimeFormat("en-US", {
    timeZoneName: "short",
  })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  return abbreviation && abbreviation !== name
    ? `${name} (${abbreviation})`
    : name;
}
