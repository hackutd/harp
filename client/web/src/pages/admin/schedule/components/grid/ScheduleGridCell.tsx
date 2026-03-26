import { memo, type MouseEvent, useCallback } from "react";

import { cn } from "@/shared/lib/utils";

import type {
  ScheduleComposerSession,
  ScheduleComposerValues,
  ScheduleItem,
} from "../../types";
import { ScheduleComposerPopover } from "../composer/ScheduleComposerPopover";
import { ScheduleEventBlock } from "./ScheduleEventBlock";

type ScheduleGridCellProps = {
  dayKey: string;
  dayIndex: number;
  quarter: number;
  startsSavedItems: readonly ScheduleItem[];
  isThirtyMinuteBoundary: boolean;
  isActive: boolean;
  isDraft: boolean;
  shouldShowComposer: boolean;
  composerSession: ScheduleComposerSession | null;
  composerDayText: string;
  composerRangeText: string;
  creatingItem: boolean;
  deletingItem: boolean;
  onCellMouseDown: (dayIndex: number, quarter: number, button: number) => void;
  onCellMouseEnter: (dayIndex: number, quarter: number) => void;
  onCellDoubleClick: (dayIndex: number, quarter: number) => void;
  onSelectExistingEvent: (item: ScheduleItem) => void;
  onComposerOpenChange: (open: boolean) => void;
  onComposerStartQuarterChange: (value: string) => void;
  onComposerEndQuarterChange: (value: string) => void;
  onComposerSave: (values: ScheduleComposerValues) => Promise<void>;
  onComposerDelete: () => Promise<void>;
};

export const ScheduleGridCell = memo(function ScheduleGridCell({
  dayKey,
  dayIndex,
  quarter,
  startsSavedItems,
  isThirtyMinuteBoundary,
  isActive,
  isDraft,
  shouldShowComposer,
  composerSession,
  composerDayText,
  composerRangeText,
  creatingItem,
  deletingItem,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onSelectExistingEvent,
  onComposerOpenChange,
  onComposerStartQuarterChange,
  onComposerEndQuarterChange,
  onComposerSave,
  onComposerDelete,
}: ScheduleGridCellProps) {
  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      onCellMouseDown(dayIndex, quarter, event.button);
    },
    [dayIndex, onCellMouseDown, quarter],
  );

  const handleMouseEnter = useCallback(() => {
    onCellMouseEnter(dayIndex, quarter);
  }, [dayIndex, onCellMouseEnter, quarter]);

  const handleDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      onCellDoubleClick(dayIndex, quarter);
    },
    [dayIndex, onCellDoubleClick, quarter],
  );

  return (
    <div
      key={`${dayKey}-${quarter}`}
      className={cn(
        "relative h-5 border-r transition-colors",
        isThirtyMinuteBoundary && "border-t",
        isDraft && "bg-indigo-400/30",
        isActive && "bg-indigo-400/30",
        !isDraft && !isActive && "hover:bg-muted/30",
      )}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onDoubleClick={handleDoubleClick}
    >
      {startsSavedItems.map((item, index) => (
        <ScheduleEventBlock
          key={item.id}
          item={item}
          index={index}
          onSelectExistingEvent={onSelectExistingEvent}
        />
      ))}

      {shouldShowComposer && composerSession ? (
        <ScheduleComposerPopover
          key={composerSession.sessionID}
          open
          session={composerSession}
          dayText={composerDayText}
          rangeText={composerRangeText}
          creatingItem={creatingItem}
          deletingItem={deletingItem}
          onOpenChange={onComposerOpenChange}
          onStartQuarterChange={onComposerStartQuarterChange}
          onEndQuarterChange={onComposerEndQuarterChange}
          onSave={onComposerSave}
          onDelete={onComposerDelete}
        />
      ) : null}
    </div>
  );
});
