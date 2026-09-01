import { Rocket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { errorAlert } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";
import { usePointsConfigStore } from "@/shared/stores";

import {
  fetchOnboardingStatus,
  updatePointsEnabled,
  updatePointsName,
} from "../api";
import { LegalSection } from "../components/LegalSection";
import { OnboardingDialog } from "../components/OnboardingDialog";
import type { OnboardingStatus } from "../types";

const CHECKLIST: { key: keyof OnboardingStatus; label: string }[] = [
  { key: "hackathon_name", label: "Hackathon name" },
  { key: "hackathon_date_range", label: "Hackathon dates" },
  { key: "application_due_date", label: "Applications due" },
  { key: "contact_email", label: "Contact email" },
  { key: "from_email", label: "Sender email" },
];

const MAX_POINTS_NAME_LENGTH = 30;

export default function HackathonTab() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const pointsName = usePointsConfigStore((s) => s.pointsName);
  const pointsEnabled = usePointsConfigStore((s) => s.pointsEnabled);
  const pointsLoading = usePointsConfigStore((s) => s.loading);
  const fetchPointsConfig = usePointsConfigStore((s) => s.fetchPointsConfig);
  const setPointsName = usePointsConfigStore((s) => s.setPointsName);
  const setPointsEnabled = usePointsConfigStore((s) => s.setPointsEnabled);

  const [pointsDraft, setPointsDraft] = useState(pointsName);
  const [nameSaving, setNameSaving] = useState(false);
  const [enabledSaving, setEnabledSaving] = useState(false);

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
    fetchPointsConfig(controller.signal);
    return () => controller.abort();
  }, [fetchPointsConfig]);

  // Sync the draft once the fetched name lands.
  useEffect(() => {
    setPointsDraft(pointsName);
  }, [pointsName]);

  const pointsDirty = pointsDraft.trim() !== pointsName;

  async function savePointsName() {
    const trimmed = pointsDraft.trim();
    if (!trimmed) {
      toast.error("Points system name must not be empty");
      return;
    }

    setNameSaving(true);
    const res = await updatePointsName(trimmed);

    if (res.status === 200 && res.data) {
      // Push into the shared store so every surface showing points picks up
      // the new label without a refetch.
      setPointsName(res.data.name);
      toast.success("Points system name saved");
    } else {
      errorAlert(res, "Failed to save points system name");
    }
    setNameSaving(false);
  }

  async function handlePointsToggle(next: boolean) {
    setEnabledSaving(true);
    const res = await updatePointsEnabled(next);

    if (res.status === 200 && res.data) {
      setPointsEnabled(res.data.enabled);
      toast.success(
        res.data.enabled
          ? "Points system enabled."
          : "Points system hidden from hackers.",
      );
    } else {
      errorAlert(res, "Failed to update the points system");
    }
    setEnabledSaving(false);
  }

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

      {/* Points system — the toggle hides points from the hacker portal
          entirely, so the name only matters while it is on. */}
      <div className="space-y-3 rounded-md bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label
              htmlFor="points-enabled"
              className="cursor-pointer text-sm font-medium text-zinc-100"
            >
              Points System
            </Label>
            <p className="text-xs text-zinc-500">
              When disabled, points are hidden from the hacker portal.
            </p>
          </div>
          <Switch
            id="points-enabled"
            checked={pointsEnabled}
            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
            disabled={pointsLoading || enabledSaving}
            onCheckedChange={handlePointsToggle}
          />
        </div>

        <div className="space-y-1">
          <Label
            htmlFor="points-name"
            className="text-sm font-medium text-zinc-100"
          >
            Points System Name
          </Label>
          <p className="text-xs text-zinc-500">
            The display name used for points across the platform (e.g.
            &ldquo;Coins&rdquo;, &ldquo;Tokens&rdquo;).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="points-name"
            value={pointsDraft}
            onChange={(e) => setPointsDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pointsDirty) savePointsName();
            }}
            placeholder="Points"
            className="h-8 w-48 border-zinc-700 bg-zinc-800 text-sm font-light text-zinc-100"
            maxLength={MAX_POINTS_NAME_LENGTH}
            disabled={pointsLoading || !pointsEnabled}
          />
          {pointsDirty && (
            <Button
              size="sm"
              className="cursor-pointer bg-white text-black hover:bg-zinc-200"
              loading={nameSaving}
              onClick={savePointsName}
            >
              Save
            </Button>
          )}
        </div>
      </div>

      <LegalSection />

      <OnboardingDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={reloadStatus}
      />
    </div>
  );
}
