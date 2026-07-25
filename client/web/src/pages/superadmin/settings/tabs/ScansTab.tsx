import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorAlert, getRequest, postRequest } from "@/shared/lib/api";

interface PointsNameResponse {
  name: string;
}

export default function ScansTab() {
  const [pointsName, setPointsName] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchPointsName() {
      const res = await getRequest<PointsNameResponse>(
        "/points-name",
        "points name",
      );
      if (res.status === 200 && res.data) {
        setPointsName(res.data.name);
        setDraft(res.data.name);
      } else {
        errorAlert(res);
      }
      setLoading(false);
    }
    fetchPointsName();
  }, []);

  const dirty = draft.trim() !== pointsName;

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("Points system name must not be empty");
      return;
    }
    if (trimmed.length > 30) {
      toast.error("Points system name must be at most 30 characters");
      return;
    }

    setSaving(true);
    const res = await postRequest<PointsNameResponse>(
      "/superadmin/settings/points-name",
      { name: trimmed },
      "points name",
    );

    if (res.status === 200 && res.data) {
      setPointsName(res.data.name);
      setDraft(res.data.name);
      toast.success("Points system name saved");
    } else {
      errorAlert(res, "Failed to save points system name");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Scans</h3>
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
            maxLength={30}
            disabled={loading}
          />
          {dirty && (
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer border-zinc-700 text-zinc-100 hover:bg-zinc-800"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
