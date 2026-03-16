import { memo } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ReviewTab } from "../store";

interface ReviewsTabToggleProps {
  activeTab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
}

export const ReviewsTabToggle = memo(function ReviewsTabToggle({
  activeTab,
  onTabChange,
}: ReviewsTabToggleProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as ReviewTab)}
    >
      <TabsList className="h-9 rounded-md border gap-0 p-0.5">
        <TabsTrigger
          value="assigned"
          className="font-light cursor-pointer rounded-sm"
        >
          Assigned
        </TabsTrigger>
        <TabsTrigger
          value="completed"
          className="font-light cursor-pointer rounded-sm"
        >
          Completed
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
});
