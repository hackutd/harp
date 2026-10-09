import { BADGE_COLORS } from "@/shared/lib/badge-colors";

import type { ScheduleItem } from "./types";

export const TAG_COLOR_STYLES: Record<string, string> = {
  Required: BADGE_COLORS.red,
  "Company Events": BADGE_COLORS.orange,
  Food: BADGE_COLORS.green,
  Workshops: BADGE_COLORS.blue,
  "For Fun": BADGE_COLORS.purple,
  Other: BADGE_COLORS.neutral,
};

export const EVENT_COLOR_STYLES: Record<
  string,
  { background: string; text: string }
> = {
  Required: {
    background: "bg-red-400/25",
    text: "text-red-900 theme-dark:text-red-200",
  },
  "Company Events": {
    background: "bg-amber-400/25",
    text: "text-amber-900 theme-dark:text-amber-200",
  },
  Food: {
    background: "bg-emerald-400/25",
    text: "text-emerald-900 theme-dark:text-emerald-200",
  },
  Workshops: {
    background: "bg-sky-400/25",
    text: "text-sky-900 theme-dark:text-sky-200",
  },
  "For Fun": {
    background: "bg-violet-400/25",
    text: "text-violet-900 theme-dark:text-violet-200",
  },
  Other: {
    background: "bg-zinc-400/25",
    text: "text-zinc-900 theme-dark:text-zinc-200",
  },
};

export function getEventColorClasses(item: ScheduleItem) {
  const tag = item.tags[0] ?? "Other";
  if (EVENT_COLOR_STYLES[tag]) {
    return EVENT_COLOR_STYLES[tag];
  }
  return EVENT_COLOR_STYLES.Other;
}
