import { MS_PER_DAY, QUARTER_HOUR_SLOTS } from "./constants";
import type { DragSelection } from "./types";

const chicagoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toInputDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDate(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

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

export function formatPickerDate(date: Date | null) {
  if (!date) return "Select date";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
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

export function getDatePartsInChicago(date: Date) {
  const parts = chicagoDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );

  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
    minute,
  };
}
