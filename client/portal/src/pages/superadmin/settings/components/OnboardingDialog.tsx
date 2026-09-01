import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, CalendarDays, Rocket } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
  fetchFromEmail,
  fetchFromName,
  fetchHackathonDateRange,
  fetchHackathonName,
  fetchPrivacyPolicyURL,
  fetchTermsURL,
  resetHackathon,
  updateApplicationDueDate,
  updateContactEmail,
  updateFromEmail,
  updateFromName,
  updateHackathonDateRange,
  updateHackathonName,
  updatePrivacyPolicyURL,
  updateTermsURL,
} from "../api";
import type { OnboardingValues } from "../types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\//i;

// Legal links are optional here on purpose: they do not count toward onboarding
// completion, so a deployment is never blocked on publishing them. When one is
// supplied it still has to be a real link.
function isValidOptionalURL(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || URL_PATTERN.test(trimmed);
}

const EMPTY_VALUES: OnboardingValues = {
  hackathon_name: "",
  start_date: "",
  end_date: "",
  application_due_date: "",
  contact_email: "",
  from_email: "",
  from_name: "",
  privacy_policy_url: "",
  terms_url: "",
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
  const [savedDateRange, setSavedDateRange] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDateChangeOpen, setConfirmDateChangeOpen] = useState(false);
  const [clearSchedule, setClearSchedule] = useState(false);

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
      setSavedDateRange(null);
      const [name, range, appDue, contact, from, fromName, privacy, terms] =
        await Promise.all([
          fetchHackathonName(controller.signal),
          fetchHackathonDateRange(controller.signal),
          fetchApplicationDueDate(controller.signal),
          fetchContactEmail(controller.signal),
          fetchFromEmail(controller.signal),
          fetchFromName(controller.signal),
          fetchPrivacyPolicyURL(controller.signal),
          fetchTermsURL(controller.signal),
        ]);
      if (controller.signal.aborted) return;

      setValues({
        hackathon_name: name.data?.name ?? "",
        start_date: range.data?.start_date ?? "",
        end_date: range.data?.end_date ?? "",
        application_due_date: appDue.data?.date ?? "",
        contact_email: contact.data?.email ?? "",
        from_email: from.data?.email ?? "",
        from_name: fromName.data?.name ?? "",
        privacy_policy_url: privacy.data?.url ?? "",
        terms_url: terms.data?.url ?? "",
      });
      setSavedDateRange(
        range.data?.start_date && range.data.end_date
          ? {
              startDate: range.data.start_date,
              endDate: range.data.end_date,
            }
          : null,
      );
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
  const parsedAppDue = useMemo(
    () => parseDateOnly(values.application_due_date),
    [values.application_due_date],
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
    if (!parsedAppDue) return "Application due date is required.";
    if (parsedAppDue > parsedStart)
      return "Applications must be due on or before the hackathon start date.";
    if (!EMAIL_PATTERN.test(values.contact_email.trim()))
      return "Enter a valid contact email.";
    if (!EMAIL_PATTERN.test(values.from_email.trim()))
      return "Enter a valid sender email.";
    if (!values.from_name.trim()) return "Sender name is required.";
    if (!isValidOptionalURL(values.terms_url))
      return "Terms of Service link must start with http:// or https://.";
    if (!isValidOptionalURL(values.privacy_policy_url))
      return "Privacy Policy link must start with http:// or https://.";
    return null;
  }, [parsedAppDue, parsedEnd, parsedStart, values]);

  const dateRangeChanged =
    savedDateRange !== null &&
    (values.start_date !== savedDateRange.startDate ||
      values.end_date !== savedDateRange.endDate);

  function requestSave() {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (dateRangeChanged) {
      setClearSchedule(false);
      setConfirmDateChangeOpen(true);
      return;
    }

    void save(false);
  }

  async function save(shouldClearSchedule: boolean) {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const responses = await Promise.all([
      updateHackathonName(values.hackathon_name.trim()),
      updateHackathonDateRange(values.start_date, values.end_date),
      updateApplicationDueDate(values.application_due_date),
      updateContactEmail(values.contact_email.trim()),
      updateFromEmail(values.from_email.trim()),
      updateFromName(values.from_name.trim()),
      updatePrivacyPolicyURL(values.privacy_policy_url.trim()),
      updateTermsURL(values.terms_url.trim()),
    ]);

    const failed = responses.find((res) => res.status !== 200);
    if (failed) {
      setSaving(false);
      errorAlert(failed);
      return;
    }

    let scheduleClearError: string | undefined;
    if (shouldClearSchedule) {
      const clearRes = await resetHackathon({
        reset_applications: false,
        reset_scans: false,
        reset_schedule: true,
        reset_settings: false,
        reset_notifications: false,
      });
      if (clearRes.status !== 200) {
        scheduleClearError = clearRes.error ?? "Unknown error";
      }
    }

    setSaving(false);
    setConfirmDateChangeOpen(false);

    if (scheduleClearError) {
      toast.error(
        `Hackathon settings saved, but clearing the schedule failed: ${scheduleClearError}`,
      );
    } else if (shouldClearSchedule) {
      toast.success("Hackathon settings saved and schedule cleared.");
    } else {
      toast.success("Hackathon settings saved.");
    }

    onSaved?.();
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          {/* Everything behind the card is blurred so setup is the only focus. */}
          <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
          <DialogPrimitive.Content
            onInteractOutside={(event) => event.preventDefault()}
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <div className="flex items-start gap-3 border-b border-zinc-800 px-6 py-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-900">
                <Rocket className="size-4 text-zinc-300" />
              </span>
              <div className="space-y-1">
                <DialogTitle className="text-lg font-normal text-zinc-100">
                  Set up your hackathon
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-400">
                  These values drive the hacker dashboard and outgoing emails.
                  You can change them later in Settings.
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
                    placeholder="Hackathon 2026"
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
                    hint="On or before the hackathon start date."
                    value={values.application_due_date}
                    disabled={loading || saving}
                    onChange={(value) =>
                      setField("application_due_date", value)
                    }
                    isDisabledDate={
                      parsedStart
                        ? (date) => date > startOfDay(parsedStart)
                        : undefined
                    }
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
                      placeholder="Hackathon"
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

                <div className="space-y-3 border-t border-zinc-800 pt-4">
                  <div className="space-y-1">
                    <Label className="text-zinc-300">
                      Legal links{" "}
                      <span className="text-xs text-zinc-500">(optional)</span>
                    </Label>
                    <p className="text-xs text-zinc-500">
                      The sign-in page tells hackers they agree to these before
                      they apply, and shows that notice only once a link is set.
                      Harp cannot provide the documents — they describe how your
                      organization handles applicant data, including the
                      demographic fields on the application form.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="onboarding-terms-url"
                        className="text-zinc-300"
                      >
                        Terms of Service URL
                      </Label>
                      <Input
                        id="onboarding-terms-url"
                        placeholder="https://yourhackathon.com/terms"
                        value={values.terms_url}
                        disabled={loading || saving}
                        onChange={(e) => setField("terms_url", e.target.value)}
                        className="border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="onboarding-privacy-url"
                        className="text-zinc-300"
                      >
                        Privacy Policy URL
                      </Label>
                      <Input
                        id="onboarding-privacy-url"
                        placeholder="https://yourhackathon.com/privacy"
                        value={values.privacy_policy_url}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setField("privacy_policy_url", e.target.value)
                        }
                        className="border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                </div>
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
                  onClick={requestSave}
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

      <Dialog
        open={confirmDateChangeOpen}
        onOpenChange={setConfirmDateChangeOpen}
      >
        <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <AlertTriangle className="size-5 text-amber-400" />
              Change hackathon dates?
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              You're about to update the hackathon date range. Any schedule
              events created for the previous dates will fall outside the new
              range and stay hidden in the admin calendar, but they will still
              be returned by the public schedule. Clean them up if you no longer
              need them.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start space-x-3 rounded-md border border-zinc-800 bg-zinc-950/50 p-4">
            <Checkbox
              id="clear-schedule"
              checked={clearSchedule}
              onCheckedChange={(checked) => setClearSchedule(!!checked)}
              disabled={saving}
              className="border-zinc-600 data-[state=checked]:border-red-600 data-[state=checked]:bg-red-600"
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="clear-schedule"
                className="text-sm leading-none font-medium text-zinc-100"
              >
                Clear existing schedule events
              </Label>
              <p className="text-xs text-zinc-500">
                Permanently deletes all current schedule events. This cannot be
                undone.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDateChangeOpen(false)}
              disabled={saving}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void save(clearSchedule)}
              disabled={saving}
              className="cursor-pointer bg-white text-black hover:bg-zinc-200"
            >
              {saving ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
