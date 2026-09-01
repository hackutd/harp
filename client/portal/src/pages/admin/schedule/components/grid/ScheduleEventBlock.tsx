import { memo } from "react";

import { cn } from "@/shared/lib/utils";

import { getEventColorClasses } from "../../styles";
import type { ScheduleItem } from "../../types";

type ScheduleEventBlockProps = {
  item: ScheduleItem;
  index: number;
  onSelectExistingEvent: (item: ScheduleItem) => void;
};

export const ScheduleEventBlock = memo(function ScheduleEventBlock({
  item,
  index,
  onSelectExistingEvent,
}: ScheduleEventBlockProps) {
  const colorClasses = getEventColorClasses(item);
  const heightPx = (item.endQuarter - item.startQuarter) * 20 - 2;
  const tagLabel = item.tags[0] ?? "Other";

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 cursor-pointer overflow-hidden rounded-none border px-1.5 py-1 text-[10px] leading-tight",
        colorClasses.border,
        colorClasses.background,
        colorClasses.text,
      )}
      style={{
        height: `${Math.max(heightPx, 18)}px`,
        zIndex: 20 + index,
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelectExistingEvent(item);
      }}
    >
      <p className="truncate font-medium">{item.title || "Untitled"}</p>
      {item.location ? (
        <p className="truncate opacity-80">{item.location}</p>
      ) : null}
      <p className="truncate opacity-70">{tagLabel}</p>
    </div>
  );
});
