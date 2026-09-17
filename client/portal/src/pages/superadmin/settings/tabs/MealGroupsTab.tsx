import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorAlert } from "@/shared/lib/api";

import { fetchMealGroups, fetchMealGroupStats, updateMealGroups } from "../api";

const MAX_GROUPS = 50;
const MAX_NAME_LENGTH = 50;

export default function MealGroupsTab() {
  const [groups, setGroups] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const [groupsRes, statsRes] = await Promise.all([
        fetchMealGroups(controller.signal),
        fetchMealGroupStats(controller.signal),
      ]);

      if (controller.signal.aborted) return;

      if (groupsRes.status === 200 && groupsRes.data) {
        setGroups(groupsRes.data.groups);
      } else {
        errorAlert(groupsRes);
      }

      if (statsRes.status === 200 && statsRes.data) {
        setStats(statsRes.data.stats);
      } else {
        errorAlert(statsRes);
      }

      setLoading(false);
    }

    load();
    return () => controller.abort();
  }, []);

  const validationError = useMemo(() => {
    const trimmed = groups.map((g) => g.trim());

    if (trimmed.some((g) => g.length === 0)) {
      return "Group names cannot be empty.";
    }
    if (trimmed.some((g) => g.length > MAX_NAME_LENGTH)) {
      return `Group names must be at most ${MAX_NAME_LENGTH} characters.`;
    }
    const seen = new Set<string>();
    for (const g of trimmed) {
      if (seen.has(g)) {
        return `Duplicate group name: ${g}`;
      }
      seen.add(g);
    }
    return null;
  }, [groups]);

  function handleNameChange(index: number, value: string) {
    setGroups((prev) => prev.map((g, i) => (i === index ? value : g)));
  }

  function handleRemove(index: number) {
    setGroups((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAdd() {
    if (groups.length >= MAX_GROUPS) {
      toast.error(`You can have at most ${MAX_GROUPS} meal groups.`);
      return;
    }
    setGroups((prev) => [...prev, ""]);
  }

  async function handleSave() {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const trimmed = groups.map((g) => g.trim());
    const res = await updateMealGroups(trimmed);

    if (res.status === 200 && res.data) {
      setGroups(res.data.groups);

      // Refresh stats so counts reflect any renamed/removed groups.
      const statsRes = await fetchMealGroupStats();
      if (statsRes.status === 200 && statsRes.data) {
        setStats(statsRes.data.stats);
      }

      toast.success("Meal groups saved.");
    } else {
      errorAlert(res);
    }

    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Meal Groups</h3>
      <p className="text-sm text-zinc-400">
        Configure the meal groups hackers are randomly assigned to when they
        check in. Renaming or removing a group does not reassign hackers who are
        already assigned.
      </p>

      <div className="bg-zinc-900 rounded-md p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium text-zinc-100">Groups</Label>
            <p className="text-xs text-zinc-500">
              Each group shows the number of hackers currently assigned to it.
            </p>
          </div>
          <UtensilsCrossed className="size-5 text-zinc-500" />
        </div>

        <div className="space-y-2">
          {groups.length === 0 && !loading ? (
            <p className="text-xs text-zinc-500">
              No meal groups configured. Add one to get started.
            </p>
          ) : null}

          {groups.map((group, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={group}
                onChange={(e) => handleNameChange(index, e.target.value)}
                disabled={loading || saving}
                maxLength={MAX_NAME_LENGTH}
                placeholder="Group name"
                className="border-zinc-800 bg-zinc-950 text-zinc-100"
              />
              <Badge
                variant="secondary"
                className="shrink-0 bg-zinc-800 text-zinc-300"
              >
                {stats[group.trim()] ?? 0} assigned
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(index)}
                disabled={loading || saving}
                aria-label="Remove group"
                className="shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={handleAdd}
          disabled={loading || saving || groups.length >= MAX_GROUPS}
          className="w-full border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
        >
          <Plus className="size-4" />
          Add Group
        </Button>

        {validationError ? (
          <p className="text-xs text-red-400">{validationError}</p>
        ) : null}

        <Button
          onClick={handleSave}
          disabled={loading || saving || !!validationError}
          className="cursor-pointer bg-white text-black hover:bg-zinc-200"
        >
          {saving ? "Saving..." : "Save Meal Groups"}
        </Button>
      </div>
    </div>
  );
}
