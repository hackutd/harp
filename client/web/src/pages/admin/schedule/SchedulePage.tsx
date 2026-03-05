import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/shared/lib/utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HALF_HOUR_SLOTS = 48;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toInputDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getDateRange(start: Date, end: Date) {
  const days: Date[] = [];
  for (let current = start; current <= end; ) {
    days.push(current);
    current = new Date(current.getTime() + MS_PER_DAY);
  }
  return days;
}

function formatDayHeader(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTime(slot: number) {
  const hour24 = Math.floor(slot / 2);
  const minute = slot % 2 === 0 ? "00" : "30";
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${suffix}`;
}

function formatPickerDate(date: Date | null) {
  if (!date) return "Select date";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function SchedulePage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [startDate, setStartDate] = useState(toInputDateValue(today));
  const [endDate, setEndDate] = useState(toInputDateValue(today));

  const parsedStart = parseDate(startDate);
  const parsedEnd = parseDate(endDate);

  const validationError = useMemo(() => {
    if (!parsedStart || !parsedEnd) {
      return "Select both a start date and an end date.";
    }

    if (parsedEnd < parsedStart) {
      return "End date must be on or after the start date.";
    }

    const durationDays =
      Math.floor(
        (startOfDay(parsedEnd).getTime() - startOfDay(parsedStart).getTime()) /
          MS_PER_DAY,
      ) + 1;

    if (durationDays > 7) {
      return "Hackathon duration cannot exceed 7 days.";
    }

    return null;
  }, [parsedEnd, parsedStart]);

  const scheduleDays = useMemo(() => {
    if (!parsedStart || !parsedEnd || validationError) return [];
    return getDateRange(startOfDay(parsedStart), startOfDay(parsedEnd));
  }, [parsedEnd, parsedStart, validationError]);

  const maxEndDate = useMemo(() => {
    if (!parsedStart) return undefined;
    return new Date(startOfDay(parsedStart).getTime() + 6 * MS_PER_DAY);
  }, [parsedStart]);

  const handleStartDateSelect = (selectedDate?: Date) => {
    if (!selectedDate) return;

    const nextStart = startOfDay(selectedDate);
    setStartDate(toInputDateValue(nextStart));

    if (!parsedEnd) {
      setEndDate(toInputDateValue(nextStart));
      return;
    }

    if (parsedEnd < nextStart) {
      setEndDate(toInputDateValue(nextStart));
      return;
    }

    const nextMaxEnd = new Date(nextStart.getTime() + 6 * MS_PER_DAY);
    if (parsedEnd > nextMaxEnd) {
      setEndDate(toInputDateValue(nextMaxEnd));
    }
  };

  const handleEndDateSelect = (selectedDate?: Date) => {
    if (!selectedDate) return;
    setEndDate(toInputDateValue(startOfDay(selectedDate)));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <Card>
        <CardHeader>
          <CardTitle>Hackathon Schedule</CardTitle>
          <CardDescription>
            Set your hackathon date range (up to 7 days), then configure time
            blocks in the grid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-between font-normal",
                      !parsedStart && "text-muted-foreground",
                    )}
                  >
                    {formatPickerDate(parsedStart)}
                    <CalendarDays className="size-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parsedStart ?? undefined}
                    defaultMonth={parsedStart ?? undefined}
                    onSelect={handleStartDateSelect}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-between font-normal",
                      !parsedEnd && "text-muted-foreground",
                    )}
                  >
                    {formatPickerDate(parsedEnd)}
                    <CalendarDays className="size-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parsedEnd ?? undefined}
                    defaultMonth={parsedEnd ?? undefined}
                    onSelect={handleEndDateSelect}
                    disabled={(date) =>
                      !parsedStart ||
                      date < startOfDay(parsedStart) ||
                      (maxEndDate ? date > startOfDay(maxEndDate) : false)
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {validationError ? (
            <p className="text-sm text-destructive">{validationError}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Showing {scheduleDays.length}{" "}
              {scheduleDays.length === 1 ? "day" : "days"} in 30-minute
              intervals.
            </p>
          )}
        </CardContent>
      </Card>

      {!validationError && scheduleDays.length > 0 ? (
        <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
          <CardContent className="h-full overflow-auto p-0">
            <div
              className="grid min-w-[760px]"
              style={{
                gridTemplateColumns: `96px repeat(${scheduleDays.length}, minmax(160px, 1fr))`,
              }}
            >
              <div className="bg-muted/30 sticky left-0 z-20 border-r border-b p-3" />
              {scheduleDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className="bg-muted/30 border-b p-3 text-center text-sm font-medium"
                >
                  {formatDayHeader(day)}
                </div>
              ))}

              {Array.from({ length: HALF_HOUR_SLOTS }).map((_, slot) => {
                const isHour = slot % 2 === 0;
                return (
                  <FragmentRow
                    key={slot}
                    slot={slot}
                    isHour={isHour}
                    scheduleDays={scheduleDays}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

type FragmentRowProps = {
  slot: number;
  isHour: boolean;
  scheduleDays: Date[];
};

function FragmentRow({ slot, isHour, scheduleDays }: FragmentRowProps) {
  const showTime = isHour && slot !== 0;

  return (
    <>
      <div className="sticky left-0 z-10 border-r bg-background text-xs relative">
        {showTime ? (
          <span className="text-muted-foreground absolute top-0 right-2 -translate-y-1/2">
            {formatTime(slot)}
          </span>
        ) : null}
      </div>
      {scheduleDays.map((day) => (
        <div
          key={`${day.toISOString()}-${slot}`}
          className="h-8 border-t border-r transition-colors hover:bg-muted/30"
        />
      ))}
    </>
  );
}
