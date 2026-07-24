import { Coins, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useScansStore } from "../store";

interface PointsNameCardProps {
  isSuperAdmin: boolean;
}

export function PointsNameCard({ isSuperAdmin }: PointsNameCardProps) {
  const { pointsName, savingPointsName, savePointsName } = useScansStore();
  const [draft, setDraft] = useState(pointsName);

  useEffect(() => {
    setDraft(pointsName);
  }, [pointsName]);

  if (!isSuperAdmin) {
    return null;
  }

  const dirty = draft.trim() !== pointsName;

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("Points system name must not be empty");
      return;
    }
    if (trimmed.length > 30) {
      toast.error("Points system name must be at most 30 characters");
      return;
    }
    await savePointsName(trimmed);
  };

  return (
    <div className="flex items-center gap-2">
      <Coins className="size-4 text-muted-foreground" />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty) handleSave();
        }}
        placeholder="Points system name"
        className="h-8 w-44 text-sm font-light"
        maxLength={30}
      />
      {dirty && (
        <Button
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={savingPointsName}
          onClick={handleSave}
        >
          {savingPointsName ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>
      )}
    </div>
  );
}
