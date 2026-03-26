import { CalendarDays, CalendarRange } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { errorAlert, getRequest, postRequest } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toInputDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export default function ScheduleTab() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  const [adminScheduleEditEnabled, setAdminScheduleEditEnabled] =
    useState(true);
  const [toggleLoading, setToggleLoading] = useState(true);
  const [toggleSaving, setToggleSaving] = useState(false);

  const parsedStart = useMemo(() => parseDate(startDate), [startDate]);
  const parsedEnd = useMemo(() => parseDate(endDate), [endDate]);

  const validationError = useMemo(() => {
    if (!startDate || !endDate) {
      return "Start date and end date are required.";
    }

    if (!parsedStart || !parsedEnd) {
      return "Dates must be valid.";
    }

    if (parsedEnd < parsedStart) {
      return "End date must be on or after start date.";
    }

    const durationDays =
      Math.floor((parsedEnd.getTime() - parsedStart.getTime()) / MS_PER_DAY) +
      1;
    if (durationDays > 7) {
      return "Hackathon date range cannot exceed 7 days.";
    }

    return null;
  }, [endDate, parsedEnd, parsedStart, startDate]);

  const maxEndDate = useMemo(() => {
    if (!parsedStart) return undefined;
    return new Date(parsedStart.getTime() + 6 * MS_PER_DAY);
  }, [parsedStart]);

  useEffect(() => {
    async function fetchSettings() {
      const [rangeRes, toggleRes] = await Promise.all([
        getRequest<{
          start_date: string | null;
          end_date: string | null;
          configured: boolean;
        }>("/superadmin/settings/hackathon-date-range", "hackathon date range"),
        getRequest<{ enabled: boolean }>(
          "/superadmin/settings/admin-schedule-edit-toggle",
          "admin schedule edit toggle",
        ),
      ]);

      if (rangeRes.status === 200 && rangeRes.data) {
        if (rangeRes.data.start_date) {
          setStartDate(rangeRes.data.start_date);
        }
        if (rangeRes.data.end_date) {
          setEndDate(rangeRes.data.end_date);
        }
      } else {
        errorAlert(rangeRes);
      }

      if (toggleRes.status === 200 && toggleRes.data) {
        setAdminScheduleEditEnabled(toggleRes.data.enabled);
      } else {
        errorAlert(toggleRes);
      }

      setLoading(false);
      setToggleLoading(false);
    }

    fetchSettings();
  }, []);

  async function saveDateRange() {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const res = await postRequest<{
      start_date: string;
      end_date: string;
      configured: boolean;
    }>(
      "/superadmin/settings/hackathon-date-range",
      {
        start_date: startDate,
        end_date: endDate,
      },
      "hackathon date range",
    );

    if (res.status === 200 && res.data) {
      setStartDate(res.data.start_date);
      setEndDate(res.data.end_date);
      toast.success("Hackathon date range saved.");
    } else {
      errorAlert(res);
    }

    setSaving(false);
  }

  async function handleToggle(nextValue: boolean) {
    setToggleSaving(true);
    const res = await postRequest<{ enabled: boolean }>(
      "/superadmin/settings/admin-schedule-edit-toggle",
      { enabled: nextValue },
      "admin schedule edit toggle",
    );

    if (res.status === 200 && res.data) {
      setAdminScheduleEditEnabled(res.data.enabled);
      toast.success(
        res.data.enabled
          ? "Admins can now edit schedule."
          : "Admins are now blocked from editing schedule.",
      );
    } else {
      errorAlert(res);
    }

    setToggleSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Schedule</h3>
      <p className="text-sm text-zinc-400">
        Configure the hackathon date range and schedule editing permissions.
      </p>

      <div className="bg-zinc-900 rounded-md p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium text-zinc-100">
              Hackathon Dates
            </Label>
            <p className="text-xs text-zinc-500">
              Must be at most 7 days inclusive. Schedule events are validated
              against this range.
            </p>
          </div>
          <CalendarRange className="size-5 text-zinc-500" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hackathon-start-date" className="text-zinc-300">
              Start date
            </Label>
            <Popover open={startPickerOpen} onOpenChange={setStartPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="hackathon-start-date"
                  variant="outline"
                  disabled={loading || saving}
                  className={cn(
                    "w-full justify-between border-zinc-800 bg-zinc-950 font-normal text-zinc-100 hover:bg-zinc-900 hover:text-zinc-100",
                    !parsedStart && "text-zinc-400 hover:text-zinc-300",
                  )}
                >
                  {formatPickerDate(parsedStart)}
                  <CalendarDays className="size-4 text-zinc-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={parsedStart ?? undefined}
                  defaultMonth={parsedStart ?? undefined}
                  onSelect={(selectedDate) => {
                    if (!selectedDate) return;
                    setStartDate(toInputDateValue(selectedDate));
                    setStartPickerOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hackathon-end-date" className="text-zinc-300">
              End date
            </Label>
            <Popover open={endPickerOpen} onOpenChange={setEndPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="hackathon-end-date"
                  variant="outline"
                  disabled={loading || saving}
                  className={cn(
                    "w-full justify-between border-zinc-800 bg-zinc-950 font-normal text-zinc-100 hover:bg-zinc-900 hover:text-zinc-100",
                    !parsedEnd && "text-zinc-400 hover:text-zinc-300",
                  )}
                >
                  {formatPickerDate(parsedEnd)}
                  <CalendarDays className="size-4 text-zinc-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={parsedEnd ?? undefined}
                  defaultMonth={parsedEnd ?? parsedStart ?? undefined}
                  onSelect={(selectedDate) => {
                    if (!selectedDate) return;
                    setEndDate(toInputDateValue(selectedDate));
                    setEndPickerOpen(false);
                  }}
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
          <p className="text-xs text-red-400">{validationError}</p>
        ) : null}

        <Button
          onClick={saveDateRange}
          disabled={loading || saving || !!validationError}
          className="cursor-pointer bg-white text-black hover:bg-zinc-200"
        >
          {saving ? "Saving..." : "Save Date Range"}
        </Button>
      </div>

      <div className="bg-zinc-900 rounded-md p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label
              htmlFor="admin-schedule-edit-toggle"
              className="text-sm font-medium text-zinc-100 cursor-pointer"
            >
              Admin Schedule Editing
            </Label>
            <p className="text-xs text-zinc-500">
              When disabled, only super admins can create, update, or delete
              schedule entries.
            </p>
          </div>
          <Switch
            checked={adminScheduleEditEnabled}
            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
            disabled={toggleLoading || toggleSaving}
            id="admin-schedule-edit-toggle"
            onCheckedChange={handleToggle}
          />
        </div>
      </div>
    </div>
  );
}
