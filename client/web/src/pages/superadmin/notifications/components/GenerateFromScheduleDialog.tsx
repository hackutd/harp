import { CalendarClock, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLocalTimeZoneLabel } from "@/shared/lib/datetime";
import type { UserRole } from "@/types";

import { fetchScheduleForNotifications } from "../api";
import type {
  GenerateScheduleNotificationsPayload,
  ScheduleEventItem,
} from "../types";

const TARGET_ALL = "__all";
type TargetOption = UserRole | typeof TARGET_ALL;

const ROLE_OPTIONS: { value: TargetOption; label: string }[] = [
  { value: TARGET_ALL, label: "All users" },
  { value: "hacker", label: "Hackers" },
  { value: "admin", label: "Admins" },
  { value: "super_admin", label: "Super Admins" },
];

const DEFAULT_LEAD_MINUTES = 10;
const MAX_LEAD_MINUTES = 1440;

interface PreviewRow {
  id: string;
  eventName: string;
  reminderAt: Date;
  skipped: boolean;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString();
}

interface GenerateFromScheduleFormProps {
  saving: boolean;
  onGenerate: (
    payload: GenerateScheduleNotificationsPayload,
  ) => Promise<boolean>;
  onCancel: () => void;
}

function GenerateFromScheduleForm({
  saving,
  onGenerate,
  onCancel,
}: GenerateFromScheduleFormProps) {
  const [leadMinutes, setLeadMinutes] = useState(String(DEFAULT_LEAD_MINUTES));
  const [target, setTarget] = useState<TargetOption>(TARGET_ALL);
  const [events, setEvents] = useState<ScheduleEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const localTimeZone = useMemo(() => getLocalTimeZoneLabel(), []);

  useEffect(() => {
    const controller = new AbortController();

    fetchScheduleForNotifications(controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.status === 200 && res.data) {
          setEvents(res.data.schedule);
        } else if (res.status !== 0) {
          setLoadError("Failed to load the schedule.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const leadValue = Number(leadMinutes);
  const leadValid =
    Number.isInteger(leadValue) &&
    leadValue >= 1 &&
    leadValue <= MAX_LEAD_MINUTES;

  const preview = useMemo<PreviewRow[]>(() => {
    if (!leadValid) return [];
    return [...events]
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((e) => {
        const reminderAt = new Date(
          new Date(e.start_time).getTime() - leadValue * 60_000,
        );
        return {
          id: e.id,
          eventName: e.event_name,
          reminderAt,
          skipped: reminderAt.getTime() <= nowMs,
        };
      });
  }, [events, leadValid, leadValue, nowMs]);

  const willAdd = preview.filter((p) => !p.skipped).length;
  const canSubmit = !saving && !loading && leadValid && willAdd > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const ok = await onGenerate({
      lead_minutes: leadValue,
      target_role: target === TARGET_ALL ? null : (target as UserRole),
    });
    if (ok) {
      onCancel();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lead-minutes">Minutes before event</Label>
          <Input
            id="lead-minutes"
            type="number"
            min={1}
            max={MAX_LEAD_MINUTES}
            step={1}
            value={leadMinutes}
            onChange={(e) => setLeadMinutes(e.target.value)}
            aria-invalid={!leadValid}
            required
          />
          {!leadValid && (
            <p role="alert" className="text-sm text-destructive">
              Enter a whole number between 1 and {MAX_LEAD_MINUTES}.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="generate-target">Target audience</Label>
          <Select
            value={target}
            onValueChange={(v) => setTarget(v as TargetOption)}
          >
            <SelectTrigger id="generate-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Reminders to add</Label>
          {!loading && !loadError && (
            <span className="text-xs text-muted-foreground">
              {willAdd} added
              {preview.length - willAdd > 0
                ? ` · ${preview.length - willAdd} skipped`
                : ""}
            </span>
          )}
        </div>

        <div className="max-h-56 overflow-auto rounded-md border">
          {loading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading schedule…
            </div>
          ) : loadError ? (
            <div className="flex h-24 items-center justify-center text-sm text-destructive">
              {loadError}
            </div>
          ) : preview.length === 0 ? (
            <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground">
              No schedule events yet. Add events to the schedule first.
            </div>
          ) : (
            <ul className="divide-y">
              {preview.map((row) => (
                <li
                  key={row.id}
                  className={`flex items-center gap-3 px-3 py-2 ${
                    row.skipped ? "opacity-50" : ""
                  }`}
                >
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {row.eventName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.skipped
                        ? "Skipped — reminder time has passed"
                        : `Reminds at ${formatDateTime(row.reminderAt)}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!loading && !loadError && preview.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Times shown in{" "}
            <span className="font-semibold">
              {localTimeZone.abbrev || localTimeZone.iana}
            </span>
          </p>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit} className="cursor-pointer">
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {willAdd > 0
            ? `Add ${willAdd} reminder${willAdd === 1 ? "" : "s"}`
            : "Add reminders"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface GenerateFromScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onGenerate: (
    payload: GenerateScheduleNotificationsPayload,
  ) => Promise<boolean>;
}

export function GenerateFromScheduleDialog({
  open,
  onOpenChange,
  saving,
  onGenerate,
}: GenerateFromScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule event reminders</DialogTitle>
          <DialogDescription>
            Create a reminder notification for each schedule event, sent the
            chosen number of minutes before it starts. Re-running replaces any
            pending reminders created this way.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <GenerateFromScheduleForm
            saving={saving}
            onGenerate={onGenerate}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
