import { memo } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/shared/lib/utils";

import type { FilterMode } from "../types";

// Segmented control: the active mode sits on a raised white pill against a
// muted track, so which filter row is showing reads at a glance.
const ITEM_CLASS = cn(
  "h-7 cursor-pointer rounded-sm px-3 font-light text-muted-foreground",
  "hover:bg-transparent hover:text-foreground",
  "data-[state=on]:bg-white data-[state=on]:text-foreground data-[state=on]:shadow-sm data-[state=on]:ring-1 data-[state=on]:ring-border",
  "data-[state=on]:hover:bg-white",
);

interface FilterModeToggleProps {
  mode: FilterMode;
  disabled?: boolean;
  onModeChange: (mode: FilterMode) => void;
}

export const FilterModeToggle = memo(function FilterModeToggle({
  mode,
  disabled,
  onModeChange,
}: FilterModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      spacing={1}
      value={mode}
      // Radix lets a single group deselect its active item; keep one mode on.
      onValueChange={(value) => value && onModeChange(value as FilterMode)}
      disabled={disabled}
      aria-label="Filter view"
      className="rounded-md border bg-muted p-0.5"
    >
      <ToggleGroupItem value="status" className={ITEM_CLASS}>
        Status
      </ToggleGroupItem>
      <ToggleGroupItem value="event" className={ITEM_CLASS}>
        Event
      </ToggleGroupItem>
    </ToggleGroup>
  );
});
