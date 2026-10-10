import {
  IconAdjustmentsHorizontal,
  IconChevronUp,
  IconClock,
  IconMapPin,
  IconTag,
  IconX,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalParts, getLocalTimeZoneLabel } from "@/shared/lib/datetime";
import {
  FALLBACK_TAG_COLOR,
  TAG_COLORS,
  tagColor,
  withAlpha,
} from "@/shared/lib/schedule-colors";
import { cn } from "@/shared/lib/utils";
import type { ScheduleItem } from "@/types";

import { getSchedule, getScheduleDateRange } from "./api";
import { ScheduleTipHost } from "./components/ScheduleTipHost";
import {
  type DayEvent,
  enumerateDays,
  formatClock,
  formatHourLabel,
  formatMonthTitle,
  HOURS_IN_DAY,
  layoutDayEvents,
  type PositionedEvent,
  type ScheduleDay,
  toDayEvent,
} from "./utils";

const HOUR_PX = 56;
const GRID_HEIGHT = HOURS_IN_DAY * HOUR_PX;
const MIN_EVENT_PX = 24;

// Hour separators drawn at the *bottom* of each cell rather than the top, so
// the first line lands one hour down instead of at y=0 — the sticky header's
// bottom border already provides the top boundary, and drawing over it would
// make the very top line read as double-thick.
const GRID_LINE_COLOR = "color-mix(in srgb, var(--hacker-ink) 8%, transparent)";
const HOUR_LINES = `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, ${GRID_LINE_COLOR} ${HOUR_PX - 1}px, ${GRID_LINE_COLOR} ${HOUR_PX}px)`;

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
        <span className="text-xs font-medium text-ink/65">Event</span>
        <button
          type="button"
          aria-label="Close event details"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-md text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <IconX className="size-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Title */}
      <h2 className="mt-1 text-[15px] leading-snug font-medium text-ink">
        {item.event_name}
      </h2>

      {/* Time */}
      <div className="mt-2.5 border-t border-ink/10 pt-2.5">
        <div className="flex items-center gap-2.5">
          <IconClock
            className="size-3.5 shrink-0 text-ink/65"
            strokeWidth={2}
          />
          <p className="text-[13px] text-ink tabular-nums">
            {formatMinutesClock(startMin)}
            <span className="mx-1.5 text-ink/65">→</span>
            {formatMinutesClock(endMin)}
            <span className="ml-2 text-ink/65">
              {formatDuration(endMin - startMin)}
            </span>
          </p>
        </div>
        {dateLabel && (
          <p className="mt-1 pl-6 text-[13px] text-ink">{dateLabel}</p>
        )}
      </div>

      {/* Location + tag */}
      <div className="mt-2.5 space-y-2 border-t border-ink/10 pt-2.5">
        <div className="flex items-center gap-2.5">
          <IconMapPin
            className="size-3.5 shrink-0 text-ink/65"
            strokeWidth={2}
          />
          {item.location ? (
            <p className="text-[13px] text-ink">{item.location}</p>
          ) : (
            <p className="text-[13px] text-ink/65">Location</p>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <IconTag className="size-3.5 shrink-0 text-ink/65" strokeWidth={2} />
          <p className="flex items-center gap-2 text-[13px] text-ink">
            <span
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: color.color }}
            />
            {color.label}
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="mt-2.5 border-t border-ink/10 pt-2.5">
        {item.description ? (
          <p className="text-[13px] leading-relaxed whitespace-pre-line text-ink/85">
            {item.description}
          </p>
        ) : (
          <p className="text-[13px] text-ink/65">Description</p>
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

  // The filter disc rides the day strip, but at the top of the page it lifts
  // up to sit level with the month title; once the strip pins, it snaps back
  // onto the strip's corner. `stuck` comes from a sentinel just above the
  // sticky header; `lift` is the distance between the two resting spots.
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);
  const [lift, setLift] = useState(0);
  const [now, setNow] = useState(() => new Date());

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

  const nowParts = useMemo(() => getLocalParts(now), [now]);
  const localTimeZone = useMemo(() => getLocalTimeZoneLabel(), []);
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

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) =>
      setStuck(!entry.isIntersecting),
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, days.length]);

  useLayoutEffect(() => {
    if (stuck) return;
    const measure = () => {
      const title = titleRef.current;
      const strip = stripRef.current;
      if (!title || !strip) return;
      const t = title.getBoundingClientRect();
      const s = strip.getBoundingClientRect();
      setLift(s.top + s.height / 2 - (t.top + t.height / 2));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [stuck, loading, days.length]);

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
      <ScheduleTipHost ready={!loading && items.length > 0} />

      {/* Header */}
      <div className="flex items-center">
        <h1
          ref={titleRef}
          className="text-[26px] leading-none font-light tracking-tight text-ink"
        >
          {days.length > 0 ? formatMonthTitle(days) : "Schedule"}
        </h1>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-10 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : days.length === 0 ? (
        <p className="pt-16 text-center text-sm font-light text-ink/65">
          The schedule hasn't been posted yet. Check back soon.
        </p>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="relative mt-3">
            <div ref={sentinelRef} aria-hidden className="h-px" />
            {/* Sticky header — day strip + column labels stay pinned on scroll */}
            <div className="sticky top-0 z-30 bg-canvas/95 pt-2 backdrop-blur-md">
              {/* Day strip — one cell per hackathon day, today in a solid
                  required-red disc. Offset by
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
                      className="text-center text-[10px] font-medium tracking-wide text-ink/85 uppercase"
                    >
                      {format(day.date, "EEEEE")}
                    </span>
                  ))}
                  <div
                    ref={stripRef}
                    className="relative col-span-full grid rounded-full bg-surface-2 p-1"
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
                                ? "font-medium text-white"
                                : "font-light text-ink/65",
                            )}
                            style={
                              isToday
                                ? { backgroundColor: TAG_COLORS.required.color }
                                : undefined
                            }
                          >
                            {format(day.date, "d")}
                          </span>
                        </div>
                      );
                    })}

                    {/* Filter toggle — a frosted-glass disc parked on the
                        right end of the strip. At the top of the page it
                        lifts to the month title; once the strip pins it
                        snaps onto the strip's corner. */}
                    <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Filter events"
                          className={cn(
                            "zero-glass-button absolute top-1/2 -right-px flex size-10 items-center justify-center rounded-full text-ink transition-[translate,background-color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
                            filterOpen && "is-open",
                          )}
                          style={{
                            translate: `0 calc(-50% - ${stuck ? 0 : lift}px)`,
                          }}
                        >
                          {filterOpen ? (
                            <IconChevronUp
                              className="size-4.5"
                              strokeWidth={1.75}
                            />
                          ) : (
                            <IconAdjustmentsHorizontal
                              className="size-4.5"
                              strokeWidth={1.75}
                            />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-56 rounded-2xl border border-ink/15 !bg-surface-2 p-1.5 text-ink"
                      >
                        {FILTER_OPTIONS.map(({ key, label, color }) => (
                          <label
                            key={key}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink/5"
                          >
                            <span className="flex items-center gap-3">
                              <span
                                className="size-4 rounded"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-sm font-light">
                                {label}
                              </span>
                            </span>
                            <Checkbox
                              checked={selectedTags.has(key)}
                              onCheckedChange={() => toggleTag(key)}
                              aria-label={`Filter by ${label}`}
                              className="border-ink/25 data-[state=checked]:border-tide data-[state=checked]:bg-tide data-[state=checked]:text-white"
                            />
                          </label>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Column headers — timezone label sits in the hour gutter, on
                  the same row as the date headers. */}
              <div className="mt-3 flex border-b border-ink/10">
                <div className="flex w-14 shrink-0 items-end justify-end pr-2 pb-2">
                  <span className="text-[11px] font-semibold text-ink/65">
                    {localTimeZone.abbrev || localTimeZone.iana}
                  </span>
                </div>
                {days.map((day) => {
                  const isToday = day.dateKey === nowParts.dateKey;
                  return (
                    <div
                      key={day.dateKey}
                      className="min-w-0 flex-1 border-l border-ink/10 px-2 pt-1 pb-2 text-center"
                    >
                      <span
                        className={cn(
                          "block truncate text-xs font-medium",
                          isToday ? "font-semibold text-ink" : "text-ink/85",
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
                {hours.map((hour) => {
                  const { value, suffix } = formatHourLabel(hour);
                  return (
                    <span
                      key={hour}
                      className={cn(
                        "absolute right-2 text-[11px] font-light text-ink/65",
                        hour !== 0 && "-translate-y-1/2",
                      )}
                      style={{ top: hour * HOUR_PX }}
                    >
                      {value}
                      <span className="ml-0.5 text-[8px] text-ink/65">
                        {suffix}
                      </span>
                    </span>
                  );
                })}

                {showNow && (
                  <span
                    className="absolute right-0 z-20 -translate-y-1/2 rounded-sm bg-red-400 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums"
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
                    className="relative min-w-0 flex-1 border-l border-ink/10"
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
                              backgroundColor: color.color,
                              borderRadius: "5px 0 0 5px",
                            }}
                          />
                          {/* Light fill — square against the bar, rounded on the
                              right. Goes solid with white text while selected. */}
                          <div
                            className="absolute inset-y-0 left-[5px] right-0 overflow-hidden rounded-r-sm px-2 py-1 transition-colors"
                            style={{
                              backgroundColor: isSelected
                                ? color.color
                                : withAlpha(color.color, 0.18),
                              color: isSelected ? color.ink : undefined,
                            }}
                          >
                            <p
                              className={cn(
                                "truncate text-[11px] leading-tight font-medium",
                                !isSelected && "text-ink/85",
                              )}
                            >
                              {item.event_name}
                            </p>
                            {item.location && height > 34 && (
                              <p
                                className={cn(
                                  "mt-0.5 truncate text-[10px] leading-tight font-light",
                                  isSelected ? "opacity-80" : "text-ink/65",
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
                            "bg-red-400",
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
                        className="absolute z-40 hidden w-64 rounded-lg border border-ink/15 bg-surface-2 p-3.5 md:block"
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
                        className="fixed inset-x-4 bottom-[5.5rem] z-50 rounded-lg border border-ink/15 bg-surface-2 p-3.5 md:hidden"
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
