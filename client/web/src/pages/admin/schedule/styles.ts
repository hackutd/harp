import type { ScheduleItem } from "./types";

export const TAG_COLOR_STYLES: Record<string, string> = {
  Required: "bg-red-100 border-red-200 text-red-700",
  "Company Events": "bg-amber-100 border-amber-200 text-amber-700",
  Food: "bg-emerald-100 border-emerald-200 text-emerald-700",
  Workshops: "bg-sky-100 border-sky-200 text-sky-700",
  "For Fun": "bg-violet-100 border-violet-200 text-violet-700",
  Other: "bg-zinc-200 border-zinc-300 text-zinc-700",
};

export const EVENT_COLOR_STYLES: Record<
  string,
  { border: string; background: string; text: string }
> = {
  Required: {
    border: "border-red-400",
    background: "bg-red-400/25",
    text: "text-red-900",
  },
  "Company Events": {
    border: "border-amber-400",
    background: "bg-amber-400/25",
    text: "text-amber-900",
  },
  Food: {
    border: "border-emerald-400",
    background: "bg-emerald-400/25",
    text: "text-emerald-900",
  },
  Workshops: {
    border: "border-sky-400",
    background: "bg-sky-400/25",
    text: "text-sky-900",
  },
  "For Fun": {
    border: "border-violet-400",
    background: "bg-violet-400/25",
    text: "text-violet-900",
  },
  Other: {
    border: "border-zinc-400",
    background: "bg-zinc-400/25",
    text: "text-zinc-900",
  },
};

export function getEventColorClasses(item: ScheduleItem) {
  const tag = item.tags[0] ?? "Other";
  if (EVENT_COLOR_STYLES[tag]) {
    return EVENT_COLOR_STYLES[tag];
  }
  return EVENT_COLOR_STYLES.Other;
}
