import { Rocket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/lib/utils";

import { fetchOnboardingStatus } from "../api";
import { OnboardingDialog } from "../components/OnboardingDialog";
import type { OnboardingStatus } from "../types";

const CHECKLIST: { key: keyof OnboardingStatus; label: string }[] = [
  { key: "hackathon_name", label: "Hackathon name" },
  { key: "hackathon_date_range", label: "Hackathon dates" },
  { key: "application_due_date", label: "Applications due" },
  { key: "decision_release_date", label: "Decisions released" },
  { key: "event_start_date", label: "Kickoff" },
  { key: "contact_email", label: "Contact email" },
  { key: "from_email", label: "Sender email" },
];

export default function HackathonTab() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const reloadStatus = useCallback(async () => {
    const res = await fetchOnboardingStatus();
    if (res.status === 200 && res.data) {
      setStatus(res.data);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const res = await fetchOnboardingStatus(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setStatus(res.data);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Hackathon</h3>
      <p className="text-sm text-zinc-400">
        Event identity and key dates used across the hacker portal and emails.
      </p>

      <div className="space-y-4 rounded-md bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium text-zinc-100">
              Setup form
            </Label>
            <p className="text-xs text-zinc-500">
              {status?.complete
                ? "All required settings are configured."
                : "Some required settings are still missing."}
            </p>
          </div>
          <Rocket className="size-5 text-zinc-500" />
        </div>

        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {CHECKLIST.map(({ key, label }) => (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  status?.[key] ? "bg-emerald-400" : "bg-zinc-600",
                )}
              />
              <span
                className={status?.[key] ? "text-zinc-300" : "text-zinc-500"}
              >
                {label}
              </span>
            </li>
          ))}
        </ul>

        <Button
          onClick={() => setFormOpen(true)}
          className="cursor-pointer bg-white text-black hover:bg-zinc-200"
        >
          {status?.complete ? "Edit hackathon setup" : "Finish setup"}
        </Button>
      </div>

      <OnboardingDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={reloadStatus}
      />
    </div>
  );
}
