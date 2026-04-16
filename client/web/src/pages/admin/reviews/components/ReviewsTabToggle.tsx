import { memo } from "react";

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
      <TabsList className="rounded-md border">
        <TabsTrigger
          value="assigned"
          disabled={disabled}
          className="font-light cursor-pointer rounded-sm disabled:pointer-events-none disabled:opacity-50"
        >
          Assigned
        </TabsTrigger>
        <TabsTrigger
          value="completed"
          disabled={disabled}
          className="font-light cursor-pointer rounded-sm disabled:pointer-events-none disabled:opacity-50"
        >
          Completed
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
});
