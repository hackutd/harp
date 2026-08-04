import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CalendarDays, Rocket } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { errorAlert } from "@/shared/lib/api";
import {
  formatPickerDate,
  parseDateOnly,
  startOfDay,
  toDateKey,
} from "@/shared/lib/datetime";
import { cn } from "@/shared/lib/utils";

import {
  fetchApplicationDueDate,
  fetchContactEmail,
  fetchDecisionReleaseDate,
  fetchFromEmail,
  fetchFromName,
  fetchHackathonDateRange,
  fetchHackathonName,
  updateApplicationDueDate,
  updateContactEmail,
  updateDecisionReleaseDate,
  updateFromEmail,
  updateFromName,
  updateHackathonDateRange,
  updateHackathonName,
} from "../api";
import type { OnboardingValues } from "../types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_VALUES: OnboardingValues = {
  hackathon_name: "",
  start_date: "",
  end_date: "",
  application_due_date: "",
  decision_release_date: "",
  contact_email: "",
  from_email: "",
  from_name: "",
};

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after every value saved successfully. */
  onSaved?: () => void;
}

interface DateFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  isDisabledDate?: (date: Date) => boolean;
}

function DateField({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
  isDisabledDate,
}: DateFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const parsed = useMemo(() => parseDateOnly(value), [value]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-zinc-300">
        {label}
      </Label>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-between border-zinc-800 bg-zinc-950 font-normal text-zinc-100 hover:bg-zinc-900 hover:text-zinc-100",
              !parsed && "text-zinc-400 hover:text-zinc-300",
            )}
          >
            {formatPickerDate(parsed)}
            <CalendarDays className="size-4 text-zinc-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={parsed ?? undefined}
            defaultMonth={parsed ?? undefined}
            disabled={isDisabledDate}
            onSelect={(selected) => {
              if (!selected) return;
              onChange(toDateKey(selected));
              setPickerOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

/**
 * Collects the hackathon identity and key dates that used to be hardcoded or
 * read from .env. Shown automatically to super admins until every required
 * setting is configured, and reopenable from Settings with the saved values
 * prefilled.
 */
export function OnboardingDialog({
  open,
  onOpenChange,
  onSaved,
}: OnboardingDialogProps) {
  const [values, setValues] = useState<OnboardingValues>(EMPTY_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const setField = useCallback(
    (field: keyof OnboardingValues, value: string) =>
      setValues((prev) => ({ ...prev, [field]: value })),
    [],
  );

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      const [name, range, appDue, decision, contact, from, fromName] =
        await Promise.all([
          fetchHackathonName(controller.signal),
          fetchHackathonDateRange(controller.signal),
          fetchApplicationDueDate(controller.signal),
          fetchDecisionReleaseDate(controller.signal),
          fetchContactEmail(controller.signal),
          fetchFromEmail(controller.signal),
          fetchFromName(controller.signal),
        ]);
      if (controller.signal.aborted) return;

      setValues({
        hackathon_name: name.data?.name ?? "",
        start_date: range.data?.start_date ?? "",
        end_date: range.data?.end_date ?? "",
        application_due_date: appDue.data?.date ?? "",
        decision_release_date: decision.data?.date ?? "",
        contact_email: contact.data?.email ?? "",
        from_email: from.data?.email ?? "",
        from_name: fromName.data?.name ?? "",
      });
      setLoading(false);
    };

    load();
    return () => controller.abort();
  }, [open]);

  const parsedStart = useMemo(
    () => parseDateOnly(values.start_date),
    [values.start_date],
  );
  const parsedEnd = useMemo(
    () => parseDateOnly(values.end_date),
    [values.end_date],
  );

  const validationError = useMemo(() => {
    if (!values.hackathon_name.trim()) return "Hackathon name is required.";
    if (!parsedStart || !parsedEnd)
      return "Hackathon start and end dates are required.";
    if (parsedEnd < parsedStart)
      return "Hackathon end date must be on or after the start date.";
    const durationDays =
      Math.floor((parsedEnd.getTime() - parsedStart.getTime()) / MS_PER_DAY) +
      1;
    if (durationDays > 7) return "Hackathon date range cannot exceed 7 days.";
    if (!values.application_due_date)
      return "Application due date is required.";
    if (!values.decision_release_date)
      return "Decision release date is required.";
    if (!EMAIL_PATTERN.test(values.contact_email.trim()))
      return "Enter a valid contact email.";
    if (!EMAIL_PATTERN.test(values.from_email.trim()))
      return "Enter a valid sender email.";
    if (!values.from_name.trim()) return "Sender name is required.";
    return null;
  }, [parsedEnd, parsedStart, values]);

  async function save() {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const responses = await Promise.all([
      updateHackathonName(values.hackathon_name.trim()),
      updateHackathonDateRange(values.start_date, values.end_date),
      updateApplicationDueDate(values.application_due_date),
      updateDecisionReleaseDate(values.decision_release_date),
      updateContactEmail(values.contact_email.trim()),
      updateFromEmail(values.from_email.trim()),
      updateFromName(values.from_name.trim()),
    ]);
    setSaving(false);

    const failed = responses.find((res) => res.status !== 200);
    if (failed) {
      errorAlert(failed);
      return;
    }

    toast.success("Hackathon settings saved.");
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Everything behind the card is blurred so setup is the only focus. */}
        <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-start gap-3 border-b border-zinc-800 p-6">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-900">
              <Rocket className="size-4 text-zinc-300" />
            </span>
            <div className="space-y-1">
              <DialogTitle className="text-lg font-normal text-zinc-100">
                Set up your hackathon
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-400">
                These values drive the hacker dashboard and outgoing emails. You
                can change them later in Settings.
              </DialogDescription>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-5 p-6">
              <div className="space-y-1.5">
                <Label htmlFor="onboarding-name" className="text-zinc-300">
                  Hackathon name
                </Label>
                <Input
                  id="onboarding-name"
                  placeholder="HackUTD 2026"
                  value={values.hackathon_name}
                  disabled={loading || saving}
                  onChange={(e) => setField("hackathon_name", e.target.value)}
                  className="border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <DateField
                  id="onboarding-start-date"
                  label="Hackathon start"
                  hint="Shown to hackers as the kickoff date."
                  value={values.start_date}
                  disabled={loading || saving}
                  onChange={(value) => setField("start_date", value)}
                />
                <DateField
                  id="onboarding-end-date"
                  label="Hackathon end"
                  hint="At most 7 days after the start date."
                  value={values.end_date}
                  disabled={loading || saving}
                  onChange={(value) => setField("end_date", value)}
                  isDisabledDate={(date) =>
                    !parsedStart ||
                    date < startOfDay(parsedStart) ||
                    date >
                      startOfDay(
                        new Date(parsedStart.getTime() + 6 * MS_PER_DAY),
                      )
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <DateField
                  id="onboarding-app-due"
                  label="Applications due"
                  value={values.application_due_date}
                  disabled={loading || saving}
                  onChange={(value) => setField("application_due_date", value)}
                />
                <DateField
                  id="onboarding-decisions"
                  label="Decisions released"
                  value={values.decision_release_date}
                  disabled={loading || saving}
                  onChange={(value) => setField("decision_release_date", value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="onboarding-contact" className="text-zinc-300">
                  Contact email
                </Label>
                <Input
                  id="onboarding-contact"
                  type="email"
                  placeholder="hello@yourhackathon.com"
                  value={values.contact_email}
                  disabled={loading || saving}
                  onChange={(e) => setField("contact_email", e.target.value)}
                  className="border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                />
                <p className="text-xs text-zinc-500">
                  Shown to hackers on the dashboard.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="onboarding-from-email"
                    className="text-zinc-300"
                  >
                    Sender email
                  </Label>
                  <Input
                    id="onboarding-from-email"
                    type="email"
                    placeholder="noreply@yourhackathon.com"
                    value={values.from_email}
                    disabled={loading || saving}
                    onChange={(e) => setField("from_email", e.target.value)}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="onboarding-from-name"
                    className="text-zinc-300"
                  >
                    Sender name
                  </Label>
                  <Input
                    id="onboarding-from-name"
                    placeholder="HackUTD"
                    value={values.from_name}
                    disabled={loading || saving}
                    onChange={(e) => setField("from_name", e.target.value)}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <p className="text-xs text-zinc-500">
                Email credentials (SendGrid / SMTP) stay in your deployment
                environment — only the visible sender identity lives here.
              </p>
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between gap-3 border-t border-zinc-800 p-4">
            <p className="text-xs text-red-400">{validationError ?? ""}</p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="cursor-pointer text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Later
              </Button>
              <Button
                onClick={save}
                disabled={loading || saving || !!validationError}
                className="cursor-pointer bg-white text-black hover:bg-zinc-200"
              >
                {saving ? "Saving..." : "Save setup"}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
