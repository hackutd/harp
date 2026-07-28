import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorAlert } from "@/shared/lib/api";
import { usePointsNameStore } from "@/shared/stores";

import { updatePointsName } from "../api";

const MAX_POINTS_NAME_LENGTH = 30;

export default function ScansTab() {
  const pointsName = usePointsNameStore((s) => s.pointsName);
  const loading = usePointsNameStore((s) => s.loading);
  const fetchPointsName = usePointsNameStore((s) => s.fetchPointsName);
  const setPointsName = usePointsNameStore((s) => s.setPointsName);

  const [draft, setDraft] = useState(pointsName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPointsName(controller.signal);
    return () => controller.abort();
  }, [fetchPointsName]);

  // Sync the draft once the fetched name lands.
  useEffect(() => {
    setDraft(pointsName);
  }, [pointsName]);

  const dirty = draft.trim() !== pointsName;

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("Points system name must not be empty");
      return;
    }
    if (trimmed.length > MAX_POINTS_NAME_LENGTH) {
      toast.error(
        `Points system name must be at most ${MAX_POINTS_NAME_LENGTH} characters`,
      );
      return;
    }

    setSaving(true);
    const res = await updatePointsName(trimmed);

    if (res.status === 200 && res.data) {
      // Push into the shared store so every surface showing points picks up
      // the new label without a refetch.
      setPointsName(res.data.name);
      toast.success("Points system name saved");
    } else {
      errorAlert(res, "Failed to save points system name");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Points System</h3>
      <p className="text-sm text-zinc-400">
        Configure scan and points settings.
      </p>

      <div className="bg-zinc-900 rounded-md p-4 space-y-3">
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
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && dirty) handleSave();
            }}
            placeholder="Points"
            className="h-8 w-48 text-sm font-light bg-zinc-800 border-zinc-700 text-zinc-100"
            maxLength={MAX_POINTS_NAME_LENGTH}
            disabled={loading}
          />
          {dirty && (
            <Button
              size="sm"
              className="cursor-pointer bg-white text-black hover:bg-zinc-200"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
