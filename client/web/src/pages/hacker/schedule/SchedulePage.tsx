import { format } from "date-fns";
import {
  ChevronUp,
  Clock,
  MapPin,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

import { getSchedule, getScheduleDateRange } from "./api";
import {
  CENTRAL_TZ,
  type DayEvent,
  enumerateDays,
  formatClock,
  formatHourLabel,
  formatMonthTitle,
  getCentralParts,
  HOURS_IN_DAY,
  layoutDayEvents,
  type PositionedEvent,
  type ScheduleDay,
  toDayEvent,
} from "./utils";

const HOUR_PX = 56;
const GRID_HEIGHT = HOURS_IN_DAY * HOUR_PX;
const MIN_EVENT_PX = 24;
const AUTO_SCROLL_HOUR = 7;

const HOUR_LINES = `repeating-linear-gradient(to bottom, #F0F0F0 0, #F0F0F0 1px, transparent 1px, transparent ${HOUR_PX}px)`;

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

/** Estimated card height used to keep the details card inside the grid. */
const DETAIL_CARD_CLAMP_PX = 280;

const CARD_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRAL_TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** "12:30 PM" from Central minutes-of-day. */
function formatMinutesClock(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const value = hour % 12 === 0 ? 12 : hour % 12;
  return `${value}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** "1h 15min" style duration label. */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
}

/** Notion-style details card body, shared by the desktop and mobile shells. */
function EventDetailsCard({
  positioned,
  onClose,
}: {
  positioned: PositionedEvent;
  onClose: () => void;
}) {
  const { item, startMin, endMin } = positioned;
  const color = tagColor(item.tags ?? []);
  const start = new Date(item.start_time);
  const dateLabel = Number.isNaN(start.getTime())
    ? ""
    : CARD_DATE_FORMATTER.format(start);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#9B9B9B]">Event</span>
        <button
          type="button"
          aria-label="Close event details"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-md text-[#9B9B9B] transition-colors hover:bg-[#F2F2F2] hover:text-black"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Title */}
      <h2 className="mt-1 text-[15px] leading-snug font-medium text-black">
        {item.event_name}
      </h2>

      {/* Time */}
      <div className="mt-2.5 border-t border-[#F0F0F0] pt-2.5">
        <div className="flex items-center gap-2.5">
          <Clock className="size-3.5 shrink-0 text-[#B4B4B4]" strokeWidth={2} />
          <p className="text-[13px] text-black tabular-nums">
            {formatMinutesClock(startMin)}
            <span className="mx-1.5 text-[#B4B4B4]">→</span>
            {formatMinutesClock(endMin)}
            <span className="ml-2 text-[#9B9B9B]">
              {formatDuration(endMin - startMin)}
            </span>
          </p>
        </div>
        {dateLabel && (
          <p className="mt-1 pl-6 text-[13px] text-black">{dateLabel}</p>
        )}
      </div>

      {/* Location + tag */}
      <div className="mt-2.5 space-y-2 border-t border-[#F0F0F0] pt-2.5">
        <div className="flex items-center gap-2.5">
          <MapPin
            className="size-3.5 shrink-0 text-[#B4B4B4]"
            strokeWidth={2}
          />
          {item.location ? (
            <p className="text-[13px] text-black">{item.location}</p>
          ) : (
            <p className="text-[13px] text-[#B4B4B4]">Location</p>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Tag className="size-3.5 shrink-0 text-[#B4B4B4]" strokeWidth={2} />
          <p className="flex items-center gap-2 text-[13px] text-black">
            <span
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: color.hex }}
            />
            {color.label}
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="mt-2.5 border-t border-[#F0F0F0] pt-2.5">
        {item.description ? (
          <p className="text-[13px] leading-relaxed whitespace-pre-line text-[#3D3D3D]">
            {item.description}
          </p>
        ) : (
          <p className="text-[13px] text-[#B4B4B4]">Description</p>
        )}
      </div>
    </>
  );
}

export default function SchedulePage() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const sevenAmRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolledRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const [rangeRes, scheduleRes] = await Promise.all([
        getScheduleDateRange(controller.signal),
        getSchedule(controller.signal),
      ]);
      if (controller.signal.aborted) return;

      if (rangeRes.status === 200 && rangeRes.data) {
        setStartDate(rangeRes.data.start_date);
        setEndDate(rangeRes.data.end_date);
      }
      if (scheduleRes.status === 200 && scheduleRes.data) {
        setItems(scheduleRes.data.schedule ?? []);
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

  // Fade the pinned filter button once the grid has been scrolled into.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Day columns come straight from the admin-configured hackathon dates.
  const days = useMemo<ScheduleDay[]>(
    () => enumerateDays(startDate, endDate),
    [startDate, endDate],
  );

  // Bucket visible events onto their Central-time day, then lay out overlaps.
  const eventsByDay = useMemo(() => {
    const buckets = new Map<string, PositionedEvent[]>();
    const raw = new Map<string, DayEvent[]>();

    for (const item of items) {
      if (selectedTags.size > 0 && !selectedTags.has(eventFilterKey(item))) {
        continue;
      }
      const placed = toDayEvent(item);
      if (!placed) continue;
      const list = raw.get(placed.dateKey) ?? [];
      list.push(placed.event);
      raw.set(placed.dateKey, list);
    }

    for (const [dateKey, list] of raw) {
      buckets.set(dateKey, layoutDayEvents(list));
    }
    return buckets;
  }, [items, selectedTags]);

  // Resolve the selected event to its positioned block + day column. Falls out
  // automatically (card closes) if a filter change hides the selected event.
  // Plain derivation — the React Compiler memoizes this for us.
  let selectedEvent: {
    positioned: PositionedEvent;
    dayIndex: number;
  } | null = null;
  if (selectedEventId) {
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const dayEvents = eventsByDay.get(days[dayIndex].dateKey) ?? [];
      const positioned = dayEvents.find((p) => p.item.id === selectedEventId);
      if (positioned) {
        selectedEvent = { positioned, dayIndex };
        break;
      }
    }
  }

  // Escape or clicking anywhere outside closes the details view. Event blocks
  // are excluded so their own click handler owns select/toggle — otherwise the
  // pointerdown-close re-renders before the click fires and re-selects.
  useEffect(() => {
    if (!selectedEventId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedEventId(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-event-card],[data-event-block]")) return;
      setSelectedEventId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [selectedEventId]);

  const nowParts = useMemo(() => getCentralParts(now), [now]);
  const todayIndex = useMemo(
    () => days.findIndex((day) => day.dateKey === nowParts.dateKey),
    [days, nowParts.dateKey],
  );
  const nowTop = ((nowParts.hour * 60 + nowParts.minute) / 60) * HOUR_PX;
  // Always show the now-line — its position is based on the current time of day,
  // so it stays valid even when today falls outside the hackathon date range.
  const showNow = true;

  const hours = useMemo(
    () => Array.from({ length: HOURS_IN_DAY }, (_, hour) => hour),
    [],
  );

  // On open, jump the calendar down to the morning (7 AM) so the pre-dawn hours
  // aren't the first thing hackers see. Runs once, offset for the sticky header.
  useEffect(() => {
    if (loading || days.length === 0 || hasAutoScrolledRef.current) return;

    const animationFrame = window.requestAnimationFrame(() => {
      const marker = sevenAmRef.current;
      if (!marker) return;
      const headerHeight = stickyHeaderRef.current?.offsetHeight ?? 0;
      marker.style.scrollMarginTop = `${headerHeight + 8}px`;
      marker.scrollIntoView({ behavior: "smooth", block: "start" });
      hasAutoScrolledRef.current = true;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [loading, days.length]);

  const toggleTag = (key: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-5 pt-6 pb-8 md:max-w-5xl md:px-8 md:pt-10">
      {/* Header */}
      <div className="flex items-center">
        <h1 className="text-[32px] leading-none font-light tracking-tight text-black">
          {days.length > 0 ? formatMonthTitle(days) : "Schedule"}
        </h1>
      </div>

      {/* Pinned filter toggle — stays reachable while scrolling the grid, and
          fades to translucent once the schedule has been scrolled into. The
          wrapper mirrors the page container so the button lines up on the right. */}
      <div className="pointer-events-none fixed inset-x-0 top-6 z-50 md:top-10">
        <div className="mx-auto flex max-w-2xl justify-end px-5 md:max-w-5xl md:px-8">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Filter events"
                className={cn(
                  "pointer-events-auto flex size-10 items-center justify-center rounded-full bg-[#F5F5F5] text-black shadow-sm transition-all duration-200 hover:bg-[#EDEDED]",
                  scrolled && !filterOpen
                    ? "opacity-55 hover:opacity-100"
                    : "opacity-100",
                )}
              >
                {filterOpen ? (
                  <ChevronUp className="size-4.5" strokeWidth={1.75} />
                ) : (
                  <SlidersHorizontal className="size-4.5" strokeWidth={1.75} />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="pointer-events-auto w-56 rounded-2xl border-none bg-[#1E1E1E] p-1.5 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
            >
              {FILTER_OPTIONS.map(({ key, label, hex }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/10"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="size-4 rounded"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-sm font-light">{label}</span>
                  </span>
                  <Checkbox
                    checked={selectedTags.has(key)}
                    onCheckedChange={() => toggleTag(key)}
                    aria-label={`Filter by ${label}`}
                    className="border-white/30 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                  />
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-10 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : days.length === 0 ? (
        <p className="pt-16 text-center text-sm font-light text-[#8A8A8A]">
          The schedule hasn't been posted yet. Check back soon.
        </p>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="relative mt-3">
            {/* Sticky header — day strip + column labels stay pinned on scroll */}
            <div
              ref={stickyHeaderRef}
              className="sticky top-0 z-30 bg-white pt-2"
            >
              {/* Day strip — one cell per hackathon day, today circled. Offset by
                  the hour-gutter width so it lines up with the columns below. */}
              <div className="flex">
                <div className="w-14 shrink-0" />
                <div
                  className="grid flex-1 gap-y-1"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                  }}
                >
                  {days.map((day) => (
                    <span
                      key={`${day.dateKey}-weekday`}
                      className="text-center text-[10px] font-medium tracking-wide text-[#282828] uppercase"
                    >
                      {format(day.date, "EEEEE")}
                    </span>
                  ))}
                  <div
                    className="col-span-full grid rounded-full bg-[#414141] p-1"
                    style={{
                      gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {days.map((day) => {
                      const isToday = day.dateKey === nowParts.dateKey;
                      return (
                        <div
                          key={day.dateKey}
                          className="flex items-center justify-center"
                        >
                          <span
                            className={cn(
                              "flex size-8 items-center justify-center rounded-full text-sm transition-colors",
                              isToday
                                ? "bg-[#747474] font-medium text-white"
                                : "font-light text-white/55",
                            )}
                          >
                            {format(day.date, "d")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Column headers */}
              <div className="mt-3 flex border-b border-[#EDEDED]">
                <div className="w-14 shrink-0" />
                {days.map((day) => {
                  const isToday = day.dateKey === nowParts.dateKey;
                  return (
                    <div
                      key={day.dateKey}
                      className="min-w-0 flex-1 border-l border-[#F0F0F0] px-2 pt-1 pb-2 text-center"
                    >
                      <span
                        className={cn(
                          "block truncate text-xs font-medium",
                          isToday
                            ? "font-semibold text-black"
                            : "text-[#282828]",
                        )}
                      >
                        {format(day.date, "EEE")} – {format(day.date, "MMM d")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body — hour gutter + day columns */}
            <div className="relative flex" style={{ height: GRID_HEIGHT }}>
              {/* Hour axis */}
              <div className="relative w-14 shrink-0">
                {/* Anchor for the on-open auto-scroll to the morning */}
                <div
                  ref={sevenAmRef}
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0"
                  style={{ top: AUTO_SCROLL_HOUR * HOUR_PX }}
                />
                {hours.map((hour) => {
                  const { value, suffix } = formatHourLabel(hour);
                  return (
                    <span
                      key={hour}
                      className={cn(
                        "absolute right-2 text-[11px] font-light text-[#B8B8B8]",
                        hour !== 0 && "-translate-y-1/2",
                      )}
                      style={{ top: hour * HOUR_PX }}
                    >
                      {value}
                      <span className="ml-0.5 text-[8px] text-[#C4C4C4]">
                        {suffix}
                      </span>
                    </span>
                  );
                })}

                {showNow && (
                  <span
                    className="absolute right-0 z-20 -translate-y-1/2 rounded-sm bg-[#FF3338] px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums"
                    style={{ top: nowTop }}
                  >
                    {formatClock(nowParts.hour, nowParts.minute)}
                  </span>
                )}
              </div>

              {/* Day columns */}
              {days.map((day, dayIndex) => {
                const isToday = dayIndex === todayIndex;
                const dayEvents = eventsByDay.get(day.dateKey) ?? [];
                return (
                  <div
                    key={day.dateKey}
                    className="relative min-w-0 flex-1 border-l border-[#F0F0F0]"
                    style={{ backgroundImage: HOUR_LINES }}
                  >
                    {dayEvents.map((positioned) => {
                      const { item, startMin, endMin, lane, laneCount } =
                        positioned;
                      const top = (startMin / 60) * HOUR_PX;
                      const height = Math.max(
                        MIN_EVENT_PX,
                        ((endMin - startMin) / 60) * HOUR_PX,
                      );
                      const color = tagColor(item.tags ?? []);
                      const widthPct = 100 / laneCount;
                      const leftPct = (lane / laneCount) * 100;
                      const isSelected = item.id === selectedEventId;
                      return (
                        <div
                          key={item.id}
                          data-event-block
                          role="button"
                          tabIndex={0}
                          aria-label={`View details for ${item.event_name}`}
                          onClick={() =>
                            setSelectedEventId((prev) =>
                              prev === item.id ? null : item.id,
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedEventId((prev) =>
                                prev === item.id ? null : item.id,
                              );
                            }
                          }}
                          className={cn(
                            "absolute cursor-pointer",
                            isSelected && "z-20",
                          )}
                          style={{
                            top,
                            height,
                            left: `${leftPct}%`,
                            width: `calc(${widthPct}% - 2px)`,
                          }}
                        >
                          {/* Dark accent bar — rounded on its own left corners */}
                          <div
                            className="absolute inset-y-0 left-0 w-[5px]"
                            style={{
                              backgroundColor: color.hex,
                              borderRadius: "5px 0 0 5px",
                            }}
                          />
                          {/* Light fill — square against the bar, rounded on the
                              right. Goes solid with white text while selected. */}
                          <div
                            className="absolute inset-y-0 left-[5px] right-0 overflow-hidden rounded-r-sm px-2 py-1 transition-colors"
                            style={{
                              backgroundColor: isSelected
                                ? color.hex
                                : withAlpha(color.hex, 0.18),
                            }}
                          >
                            <p
                              className={cn(
                                "truncate text-[11px] leading-tight font-medium",
                                isSelected ? "text-white" : "text-[#1A1A1A]",
                              )}
                            >
                              {item.event_name}
                            </p>
                            {item.location && height > 34 && (
                              <p
                                className={cn(
                                  "mt-0.5 truncate text-[10px] leading-tight font-light",
                                  isSelected
                                    ? "text-white/80"
                                    : "text-[#6B6B6B]",
                                )}
                              >
                                {item.location}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Now line — thin across every day, thick on today */}
                    {showNow && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-10 -translate-y-1/2"
                        style={{ top: nowTop }}
                      >
                        <div
                          className={cn(
                            "bg-[#FF3338]",
                            isToday
                              ? "h-[3px] rounded-full"
                              : "h-px opacity-55",
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Event details card — floats beside the selected event's day
                  column (Notion-style) on desktop, bottom sheet on mobile. */}
              {selectedEvent &&
                (() => {
                  const { positioned, dayIndex } = selectedEvent;
                  const { lane, laneCount } = positioned;
                  const eventTop = (positioned.startMin / 60) * HOUR_PX;
                  const cardTop = Math.max(
                    0,
                    Math.min(eventTop, GRID_HEIGHT - DETAIL_CARD_CLAMP_PX),
                  );
                  // Open toward the wider side of the calendar, anchored to the
                  // selected event's own edge (its lane, not the day column) so
                  // the card hugs the event even in overlap clusters.
                  const openRight = dayIndex < days.length / 2;
                  const columnFraction = `(100% - 56px) / ${days.length}`;
                  // Flush against the event: the fill is inset 2px from its
                  // lane's right edge, so subtract it when opening rightward.
                  const horizontal = openRight
                    ? {
                        left: `calc(56px + ${columnFraction} * ${dayIndex + (lane + 1) / laneCount} - 2px)`,
                      }
                    : {
                        right: `calc(${columnFraction} * ${days.length - dayIndex - lane / laneCount})`,
                      };
                  return (
                    <>
                      <div
                        data-event-card
                        className="absolute z-40 hidden w-64 rounded-lg border border-black/5 bg-white p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.16)] md:block"
                        style={{ top: cardTop, ...horizontal }}
                      >
                        <EventDetailsCard
                          positioned={positioned}
                          onClose={() => setSelectedEventId(null)}
                        />
                      </div>
                      {/* Mobile sheet — sits just above the bottom tab bar
                          (fixed bottom-4 + ~4.5rem tall). */}
                      <div
                        data-event-card
                        className="fixed inset-x-4 bottom-[5.5rem] z-50 rounded-lg border border-black/5 bg-white p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] md:hidden"
                      >
                        <EventDetailsCard
                          positioned={positioned}
                          onClose={() => setSelectedEventId(null)}
                        />
                      </div>
                    </>
                  );
                })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
