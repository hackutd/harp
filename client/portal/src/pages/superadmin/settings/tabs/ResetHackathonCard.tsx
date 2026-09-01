import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { resetHackathon } from "../api";
import type { ResetHackathonOptions } from "../types";

const RESET_ITEMS: {
  id: keyof ResetHackathonOptions;
  label: string;
  desc: string;
}[] = [
  {
    id: "reset_applications",
    label: "Applications",
    desc: "Closes applications and deletes all hacker applications, reviews, walk-in queue entries, and resume files.",
  },
  {
    id: "reset_scans",
    label: "Scans",
    desc: "Deletes all check-in, meal, and event scan records, and clears the cached scan stats.",
  },
  {
    id: "reset_scan_types",
    label: "Scan Types",
    desc: "Restores scan types to the defaults (Check In, Walk-In). Removes custom meal, swag, and shop types along with their point values.",
  },
  {
    id: "reset_schedule",
    label: "Schedule",
    desc: "Deletes all schedule events and the notifications attached to them.",
  },
  {
    id: "reset_notifications",
    label: "Notifications",
    desc: "Deletes all scheduled and sent notifications.",
  },
  {
    id: "reset_sponsors",
    label: "Sponsors",
    desc: "Deletes all sponsors, including their uploaded logos.",
  },
  {
    id: "reset_faqs",
    label: "FAQs",
    desc: "Deletes all FAQ questions and answers.",
  },
  {
    id: "reset_config",
    label: "Hackathon Config",
    desc: "Clears the hackathon name, dates, application deadline, points name, and hacker pack link. It also closes applications and disables points until the next event is configured.",
  },
  {
    id: "reset_settings",
    label: "Settings Stats",
    desc: "Resets scan stats and review assignment toggles.",
  },
];

// Everything is selected by default — a reset is normally a full wipe between
// hackathons, and leaving a domain behind orphans data in the others.
const ALL_SELECTED: ResetHackathonOptions = {
  reset_applications: true,
  reset_scans: true,
  reset_scan_types: true,
  reset_schedule: true,
  reset_settings: true,
  reset_notifications: true,
  reset_sponsors: true,
  reset_faqs: true,
  reset_config: true,
};

const NONE_SELECTED: ResetHackathonOptions = {
  reset_applications: false,
  reset_scans: false,
  reset_scan_types: false,
  reset_schedule: false,
  reset_settings: false,
  reset_notifications: false,
  reset_sponsors: false,
  reset_faqs: false,
  reset_config: false,
};

export function ResetHackathonCard() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [options, setOptions] = useState<ResetHackathonOptions>(ALL_SELECTED);

  const allSelected = Object.values(options).every(Boolean);
  const noneSelected = !Object.values(options).some(Boolean);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirmText("");
      setOptions(ALL_SELECTED);
    }
  };

  const handleReset = async () => {
    if (confirmText !== "RESET HACKATHON") return;

    // Ensure at least one option is selected
    if (noneSelected) {
      toast.error("Please select at least one item to reset");
      return;
    }

    setLoading(true);
    try {
      const res = await resetHackathon(options);

      if (res.error) {
        toast.error(res.error);
        return;
      }

      const resumes = res.data?.resumes_deleted ?? 0;
      const receipts = res.data?.receipts_deleted ?? 0;
      const files = resumes + receipts;
      const notes = [
        files > 0
          ? `queued ${files} uploaded file${files === 1 ? "" : "s"} for storage cleanup`
          : null,
        // Closing applications is a side effect of the config reset that a
        // super admin has to know about — it silently takes the public form down.
        res.data?.reset_config ? "applications are now closed" : null,
      ].filter(Boolean);

      toast.success(
        notes.length > 0
          ? `Hackathon data reset successfully — ${notes.join("; ")}`
          : "Hackathon data reset successfully",
      );
      handleOpenChange(false);
    } catch (err) {
      toast.error(
        "An unexpected error occurred" +
          (err instanceof Error ? `: ${err.message}` : ""),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800 border-0 rounded-md">
      <CardHeader>
        <CardTitle className="text-red-400 flex items-center gap-2">
          <AlertTriangle className="size-5" />
          Danger Zone
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Irreversible actions that destroy data. Proceed with caution.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto cursor-pointer bg-white text-black hover:bg-zinc-200">
              <Trash2 className="mr-2 size-4" />
              Reset Options
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-red-400 flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Reset Hackathon Data
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                This action cannot be undone. This will permanently delete the
                selected data from the database and remove associated files.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="space-y-3 border border-zinc-800 rounded-md p-4 bg-zinc-950/50">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <span className="text-xs uppercase tracking-wide text-zinc-500">
                    Everything is selected by default
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setOptions(allSelected ? NONE_SELECTED : ALL_SELECTED)
                    }
                    className="text-xs font-medium text-zinc-300 hover:text-zinc-100 underline underline-offset-2 cursor-pointer"
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                </div>

                {/* Two columns so every option is visible at once — a super
                    admin picking what to wipe shouldn't have to scroll past
                    options they can't see. */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {RESET_ITEMS.map((item) => (
                    <div
                      key={item.id}
                      className="flex h-full items-start space-x-3 rounded-md border border-zinc-800/80 bg-zinc-900/40 p-3"
                    >
                      <Checkbox
                        id={item.id}
                        checked={options[item.id]}
                        onCheckedChange={(c) =>
                          setOptions((prev) => ({
                            ...prev,
                            [item.id]: !!c,
                          }))
                        }
                        className="mt-0.5 border-zinc-600 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label
                          htmlFor={item.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-zinc-100"
                        >
                          {item.label}
                        </Label>
                        <p className="text-xs leading-relaxed text-zinc-500">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <p className="text-xs leading-relaxed text-zinc-500">
                  A full reset keeps user accounts and roles, contact and sender
                  details, the application form schema, review count, admin
                  permissions, meal-group names, and push-notification opt-ins.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-zinc-100">
                    Type{" "}
                    <strong className="text-red-400">RESET HACKATHON</strong> to
                    confirm
                  </Label>
                  <Input
                    id="confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="RESET HACKATHON"
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-red-400/20 focus-visible:border-red-400"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
                className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                loading={loading}
                disabled={confirmText !== "RESET HACKATHON" || noneSelected}
              >
                Reset Data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
