import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePointsConfigStore } from "@/shared/stores";

import type { ScanType, ScanTypeCategory } from "../types";
import { categoryOptions } from "../utils";

export interface ScanTypeFormValues {
  display_name: string;
  category: ScanTypeCategory;
  points: number;
  is_active: boolean;
}

interface ScanTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanType: ScanType | null;
  saving: boolean;
  onSubmit: (values: ScanTypeFormValues) => void;
}

function ScanTypeForm({
  scanType,
  saving,
  onSubmit,
  onCancel,
}: {
  scanType: ScanType | null;
  saving: boolean;
  onSubmit: (values: ScanTypeFormValues) => void;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState(scanType?.display_name ?? "");
  const [category, setCategory] = useState<ScanTypeCategory>(
    scanType?.category ?? "other",
  );
  const [points, setPoints] = useState(String(scanType?.points ?? 0));
  const [isActive, setIsActive] = useState(scanType?.is_active ?? true);
  const pointsName = usePointsConfigStore((s) => s.pointsName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    const parsedPoints = Number.parseInt(points, 10);
    onSubmit({
      display_name: displayName.trim(),
      category,
      points: Number.isNaN(parsedPoints) ? 0 : parsedPoints,
      is_active: isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="scan-type-name">Name</Label>
        <Input
          id="scan-type-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Sunday Lunch"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="scan-type-category">Category</Label>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as ScanTypeCategory)}
        >
          <SelectTrigger id="scan-type-category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scan-type-points">{pointsName}</Label>
        <Input
          id="scan-type-points"
          type="number"
          min={0}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="scan-type-active"
          checked={isActive}
          onCheckedChange={setIsActive}
          className="cursor-pointer"
        />
        <Label htmlFor="scan-type-active">Active</Label>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={saving}
          disabled={!displayName.trim()}
          className="cursor-pointer"
        >
          {scanType ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ScanTypeFormDialog({
  open,
  onOpenChange,
  scanType,
  saving,
  onSubmit,
}: ScanTypeFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {scanType ? "Edit Scan Type" : "Add Scan Type"}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <ScanTypeForm
            key={scanType?.name ?? "new"}
            scanType={scanType}
            saving={saving}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
