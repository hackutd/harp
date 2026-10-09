import { memo } from "react";

import { SegmentedHighlight } from "@/components/SegmentedHighlight";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ReviewTab } from "../store";

interface ReviewsTabToggleProps {
  activeTab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
  disabled?: boolean;
}

export const ReviewsTabToggle = memo(function ReviewsTabToggle({
  activeTab,
  onTabChange,
  disabled,
}: ReviewsTabToggleProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => !disabled && onTabChange(value as ReviewTab)}
    >
      <TabsList className="relative h-9 rounded-md border bg-toggle-track gap-0 p-0.5">
        <SegmentedHighlight />
        <TabsTrigger
          value="assigned"
          disabled={disabled}
          className="font-light text-muted-foreground hover:text-foreground relative data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none cursor-pointer rounded-sm disabled:pointer-events-none disabled:opacity-50"
        >
          Assigned
        </TabsTrigger>
        <TabsTrigger
          value="completed"
          disabled={disabled}
          className="font-light text-muted-foreground hover:text-foreground relative data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none cursor-pointer rounded-sm disabled:pointer-events-none disabled:opacity-50"
        >
          Completed
        </TabsTrigger>
        <TabsTrigger
          value="leaderboard"
          disabled={disabled}
          className="font-light text-muted-foreground hover:text-foreground relative data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none cursor-pointer rounded-sm disabled:pointer-events-none disabled:opacity-50"
        >
          Leaderboard
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
});
