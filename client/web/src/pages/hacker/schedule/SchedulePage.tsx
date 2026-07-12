import { format, isSameDay, parseISO } from "date-fns";
import { ListFilter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FALLBACK_TAG_COLOR,
  TAG_COLORS,
  tagColor,
  withAlpha,
} from "@/shared/lib/schedule-colors";
import { cn } from "@/shared/lib/utils";
import type { ScheduleItem } from "@/types";

import { getSchedule } from "./api";

const HOUR_PX = 64;

const FILTER_OPTIONS = [
  ...Object.entries(TAG_COLORS).map(([key, color]) => ({ key, ...color })),
  { key: "other", ...FALLBACK_TAG_COLOR },
];

function eventFilterKey(item: ScheduleItem): string {
  for (const tag of item.tags ?? []) {
    if (TAG_COLORS[tag.toLowerCase()]) return tag.toLowerCase();
  }
  return "other";
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export default function SchedulePage() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const res = await getSchedule(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setItems(res.data.schedule ?? []);
      }
      setLoading(false);
    };
    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Unique event days, sorted
  const days = useMemo(() => {
    const seen = new Map<string, Date>();
    for (const item of items) {
      const d = parseISO(item.start_time);
      const key = format(d, "yyyy-MM-dd");
      if (!seen.has(key)) seen.set(key, d);
    }
    return [...seen.values()].sort((a, b) => a.getTime() - b.getTime());
  }, [items]);

  const activeDay = useMemo(() => {
    if (selectedDay) return selectedDay;
    const today = days.find((d) => isSameDay(d, now));
    return today ?? days[0] ?? now;
  }, [selectedDay, days, now]);

  const dayEvents = useMemo(
    () =>
      items
        .filter((item) => isSameDay(parseISO(item.start_time), activeDay))
        .filter((item) => !hiddenTags.has(eventFilterKey(item)))
        .sort(
          (a, b) =>
            parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime(),
        ),
    [items, activeDay, hiddenTags],
  );

  // Hour axis bounds derived from the day's events
  const [startHour, endHour] = useMemo(() => {
    if (dayEvents.length === 0) return [9, 21];
    let min = 23;
    let max = 1;
    for (const item of dayEvents) {
      min = Math.min(min, parseISO(item.start_time).getHours());
      max = Math.max(max, parseISO(item.end_time).getHours() + 1);
    }
    return [Math.max(0, min - 1), Math.min(24, max + 1)];
  }, [dayEvents]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = startHour; h <= endHour; h++) list.push(h);
    return list;
  }, [startHour, endHour]);

  const showNowLine =
    isSameDay(activeDay, now) &&
    minutesOfDay(now) >= startHour * 60 &&
    minutesOfDay(now) <= endHour * 60;

  const toggleTag = (key: string) => {
    setHiddenTags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-5 pt-6 pb-8 md:px-10 md:pt-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-black">
            Schedule
          </h1>
          <p className="text-sm font-light text-[#8A8A8A]">
            {format(activeDay, "EEEE, MMMM d")}
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Filter events"
              className="flex size-10 items-center justify-center rounded-full border border-[#E5E5E5] text-black transition-colors hover:bg-[#F5F5F5]"
            >
              <ListFilter className="size-4.5" strokeWidth={1.5} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-52 rounded-xl border-none bg-black/90 p-2 text-white backdrop-blur-sm"
          >
            <p className="px-2 pt-1 pb-2 text-xs font-light tracking-wide text-white/60">
              Categories
            </p>
            {FILTER_OPTIONS.map(({ key, label, hex }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/10"
              >
                <Checkbox
                  checked={!hiddenTags.has(key)}
                  onCheckedChange={() => toggleTag(key)}
                  className="border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                />
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-sm font-light">{label}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Day strip */}
      {days.length > 0 && (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const isSelected = isSameDay(day, activeDay);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-0.5 rounded-full px-4 py-2.5 transition-colors",
                  isSelected
                    ? "bg-black text-white"
                    : "bg-[#F5F5F5] text-black hover:bg-[#EDEDED]",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-light uppercase tracking-wide",
                    isSelected ? "text-white/70" : "text-[#8A8A8A]",
                  )}
                >
                  {format(day, "EEE")}
                </span>
                <span className="text-base font-light">{format(day, "d")}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : items.length === 0 ? (
          <p className="pt-8 text-center text-sm font-light text-[#8A8A8A]">
            The schedule hasn't been posted yet. Check back soon.
          </p>
        ) : dayEvents.length === 0 ? (
          <p className="pt-8 text-center text-sm font-light text-[#8A8A8A]">
            No events for this day.
          </p>
        ) : (
          <div
            className="relative"
            style={{ height: `${(endHour - startHour) * HOUR_PX}px` }}
          >
            {/* Hour gridlines */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 flex items-start gap-3"
                style={{ top: `${(hour - startHour) * HOUR_PX}px` }}
              >
                <span className="w-12 shrink-0 -translate-y-1.5 text-right text-[11px] font-light text-[#B8B8B8]">
                  {format(new Date(0, 0, 0, hour), "h a")}
                </span>
                <span className="mt-0 h-px flex-1 bg-[#F0F0F0]" />
              </div>
            ))}

            {/* Events */}
            {dayEvents.map((item) => {
              const start = parseISO(item.start_time);
              const end = parseISO(item.end_time);
              const top =
                ((minutesOfDay(start) - startHour * 60) / 60) * HOUR_PX;
              const height = Math.max(
                36,
                ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_PX,
              );
              const color = tagColor(item.tags ?? []);

              return (
                <div
                  key={item.id}
                  className="absolute right-0 left-15 overflow-hidden rounded-lg px-3 py-2"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    backgroundColor: withAlpha(color.hex, 0.12),
                    borderLeft: `3px solid ${color.hex}`,
                  }}
                >
                  <p className="truncate text-sm font-normal text-black">
                    {item.event_name}
                  </p>
                  <p className="truncate text-xs font-light text-[#6B6B6B]">
                    {format(start, "h:mm a")} – {format(end, "h:mm a")}
                    {item.location ? ` · ${item.location}` : ""}
                  </p>
                </div>
              );
            })}

            {/* Now line */}
            {showNowLine && (
              <div
                className="pointer-events-none absolute right-0 left-12 z-10 flex items-center"
                style={{
                  top: `${((minutesOfDay(now) - startHour * 60) / 60) * HOUR_PX}px`,
                }}
              >
                <span className="size-2 rounded-full bg-black" />
                <span className="h-px flex-1 bg-black" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
