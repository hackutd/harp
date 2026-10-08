import { memo } from "react";

import { SegmentedHighlight } from "@/components/SegmentedHighlight";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/shared/lib/utils";

import type { FilterMode } from "../types";

// Segmented control: the active mode is a pill (SegmentedHighlight, which
// slides between modes) floating on the toggle track, matching FilterTabs.
const ITEM_CLASS = cn(
  "relative h-full cursor-pointer rounded-sm px-3 font-light text-muted-foreground",
  "hover:bg-transparent hover:text-foreground",
  "data-[state=on]:bg-transparent data-[state=on]:text-foreground",
  "data-[state=on]:hover:bg-transparent",
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
      // h-9 matches the filter tabs and dropdown beside it.
      className="relative h-9 rounded-md border bg-toggle-track p-0.5"
    >
      <SegmentedHighlight />
      <ToggleGroupItem value="status" className={ITEM_CLASS}>
        Status
      </ToggleGroupItem>
      <ToggleGroupItem value="event" className={ITEM_CLASS}>
        Event
      </ToggleGroupItem>
    </ToggleGroup>
  );
});
