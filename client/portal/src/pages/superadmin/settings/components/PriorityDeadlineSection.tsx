import { IconBolt } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePriorityDeadlineStore } from "@/pages/admin/_shared";
import { errorAlert } from "@/shared/lib/api";
import type { ApplicationStatus } from "@/types";

import { fetchPriorityDeadlineStats, updatePriorityDeadline } from "../api";
import {
  browserTimeZoneLabel,
  fromDeadlineInputValue,
  toDeadlineInputValue,
} from "../priorityDeadline";
import type { PriorityDeadlineStats } from "../types";

const COUNT_LABELS: [ApplicationStatus, string][] = [
  ["accepted", "accepted"],
  ["waitlisted", "waitlisted"],
  ["rejected", "rejected"],
  ["submitted", "under review"],
  ["draft", "reopened"],
];

function formatCounts(counts: PriorityDeadlineStats["counts"]): string {
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const parts = COUNT_LABELS.filter(([status]) => counts[status]).map(
    ([status, label]) => `${counts[status]!.toLocaleString()} ${label}`,
  );
  const summary = `${total.toLocaleString()} application${total === 1 ? "" : "s"} submitted by this deadline`;
  return parts.length > 0 ? `${summary}: ${parts.join(", ")}.` : `${summary}.`;
}

/**
 * The priority deadline: applications submitted by it get the Priority badge
 * and can be released as their own decision wave. The input is in the
 * browser's time zone, which the label names.
 */
export function PriorityDeadlineSection() {
  const [stats, setStats] = useState<PriorityDeadlineStats | null>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const setSharedDeadline = usePriorityDeadlineStore((s) => s.setDeadline);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const res = await fetchPriorityDeadlineStats(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setStats(res.data);
        setValue(toDeadlineInputValue(res.data.deadline));
      } else {
        errorAlert(res);
      }
      setLoading(false);
    }
    load();
    return () => controller.abort();
  }, []);

  const savedValue = toDeadlineInputValue(stats?.deadline ?? null);
  const dirty = value !== savedValue;
  const parsed = fromDeadlineInputValue(value);
  const invalid = value !== "" && parsed === null;
  const zoneLabel = browserTimeZoneLabel(parsed ? new Date(parsed) : undefined);

  async function save(deadline: string | null) {
    setSaving(true);
    const res = await updatePriorityDeadline(deadline);
    if (res.status === 200 && res.data) {
      setStats(res.data);
      setValue(toDeadlineInputValue(res.data.deadline));
      // Badges already on screen pick up the change without a reload.
      setSharedDeadline(res.data.deadline);
      toast.success(
        res.data.deadline
          ? "Priority deadline saved."
          : "Priority deadline cleared.",
      );
    } else {
      errorAlert(res, "Failed to save the priority deadline");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3 rounded-md bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label
            htmlFor="priority-deadline"
            className="text-sm font-medium text-zinc-100"
          >
            Priority Deadline
          </Label>
          <p className="text-xs text-zinc-500">
            Applications submitted by this time are marked Priority for
            reviewers and can be released as their own decision wave. A reopened
            application keeps its first submission time.
          </p>
        </div>
        <IconBolt className="size-5 shrink-0 text-zinc-500" />
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="priority-deadline"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={loading || saving}
            aria-describedby="priority-deadline-zone"
            aria-invalid={invalid}
            className="h-8 w-56 border-zinc-700 bg-zinc-800 text-sm font-light text-zinc-100"
          />
          {dirty && (
            <Button
              size="sm"
              className="cursor-pointer bg-white text-black hover:bg-zinc-200"
              loading={saving}
              disabled={invalid}
              onClick={() => save(parsed)}
            >
              Save
            </Button>
          )}
          {!dirty && stats?.deadline && (
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer font-light"
              loading={saving}
              onClick={() => save(null)}
            >
              Clear
            </Button>
          )}
        </div>
        <p id="priority-deadline-zone" className="text-xs text-zinc-500">
          Your time zone: {zoneLabel}. The deadline includes the whole minute
          you pick.
        </p>
      </div>

      {!loading && (
        <p className="text-xs text-zinc-400">
          {stats?.deadline
            ? formatCounts(stats.counts)
            : "No priority deadline set: no application is marked Priority."}
        </p>
      )}
    </div>
  );
}
