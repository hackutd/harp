import { memo, type RefObject } from "react";

import type {
  ScheduleComposerSession,
  ScheduleComposerValues,
  ScheduleItem,
  SelectionRange,
} from "../../types";
import { formatQuarterTime } from "../../utils";
import { ScheduleGridCell } from "./ScheduleGridCell";

type ScheduleGridRowProps = {
  quarter: number;
  scheduleDays: Date[];
  activeSelection: SelectionRange | null;
  composerSession: ScheduleComposerSession | null;
  composerDayText: string;
  composerRangeText: string;
  creatingItem: boolean;
  deletingItem: boolean;
  getStartsAt: (dayIndex: number, quarter: number) => readonly ScheduleItem[];
  onCellMouseDown: (dayIndex: number, quarter: number, button: number) => void;
  onCellMouseEnter: (dayIndex: number, quarter: number) => void;
  onCellDoubleClick: (dayIndex: number, quarter: number) => void;
  onSelectExistingEvent: (item: ScheduleItem) => void;
  onComposerOpenChange: (open: boolean) => void;
  onComposerStartQuarterChange: (value: string) => void;
  onComposerEndQuarterChange: (value: string) => void;
  onComposerSave: (values: ScheduleComposerValues) => Promise<void>;
  onComposerDelete: () => Promise<void>;
  eightAmRowRef?: RefObject<HTMLSpanElement | null>;
};

function quarterInSelection(selection: SelectionRange | null, quarter: number) {
  if (!selection) return false;
  return quarter >= selection.startQuarter && quarter < selection.endQuarter;
}

function quarterInComposer(
  session: ScheduleComposerSession | null,
  quarter: number,
) {
  if (!session) return false;
  return quarter >= session.startQuarter && quarter < session.endQuarter;
}

function quarterIsComposerStart(
  session: ScheduleComposerSession | null,
  quarter: number,
) {
  if (!session) return false;
  return quarter === session.startQuarter;
}

export const ScheduleGridRow = memo(
  function ScheduleGridRow({
    quarter,
    scheduleDays,
    activeSelection,
    composerSession,
    composerDayText,
    composerRangeText,
    creatingItem,
    deletingItem,
    getStartsAt,
    onCellMouseDown,
    onCellMouseEnter,
    onCellDoubleClick,
    onSelectExistingEvent,
    onComposerOpenChange,
    onComposerStartQuarterChange,
    onComposerEndQuarterChange,
    onComposerSave,
    onComposerDelete,
    eightAmRowRef,
  }: ScheduleGridRowProps) {
    const isHourBoundary = quarter % 4 === 0;
    const isThirtyMinuteBoundary = quarter % 2 === 0 && quarter !== 0;
    const showTime = isHourBoundary && quarter !== 0;

    return (
      <>
        <div className="sticky left-0 z-10 border-r bg-background text-xs relative">
          {showTime ? (
            <span
              ref={eightAmRowRef}
              className="text-muted-foreground absolute top-0 right-2 -translate-y-1/2"
            >
              {formatQuarterTime(quarter)}
            </span>
          ) : null}
        </div>

        {scheduleDays.map((day, dayIndex) => {
          const startsSavedItems = getStartsAt(dayIndex, quarter);
          const isActive =
            activeSelection?.dayIndex === dayIndex &&
            quarterInSelection(activeSelection, quarter);
          const isDraft =
            composerSession?.dayIndex === dayIndex &&
            quarterInComposer(composerSession, quarter);
          const shouldShowComposer =
            composerSession?.dayIndex === dayIndex &&
            quarterIsComposerStart(composerSession, quarter);

          return (
            <ScheduleGridCell
              key={`${day.toISOString()}-${quarter}`}
              dayKey={day.toISOString()}
              dayIndex={dayIndex}
              quarter={quarter}
              startsSavedItems={startsSavedItems}
              isThirtyMinuteBoundary={isThirtyMinuteBoundary}
              isActive={!!isActive}
              isDraft={!!isDraft}
              shouldShowComposer={!!shouldShowComposer}
              composerSession={composerSession}
              composerDayText={composerDayText}
              composerRangeText={composerRangeText}
              creatingItem={creatingItem}
              deletingItem={deletingItem}
              onCellMouseDown={onCellMouseDown}
              onCellMouseEnter={onCellMouseEnter}
              onCellDoubleClick={onCellDoubleClick}
              onSelectExistingEvent={onSelectExistingEvent}
              onComposerOpenChange={onComposerOpenChange}
              onComposerStartQuarterChange={onComposerStartQuarterChange}
              onComposerEndQuarterChange={onComposerEndQuarterChange}
              onComposerSave={onComposerSave}
              onComposerDelete={onComposerDelete}
            />
          );
        })}
      </>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.quarter !== nextProps.quarter) return false;
    if (prevProps.scheduleDays !== nextProps.scheduleDays) return false;
    if (prevProps.getStartsAt !== nextProps.getStartsAt) return false;
    if (prevProps.onCellMouseDown !== nextProps.onCellMouseDown) return false;
    if (prevProps.onCellMouseEnter !== nextProps.onCellMouseEnter) return false;
    if (prevProps.onCellDoubleClick !== nextProps.onCellDoubleClick)
      return false;
    if (prevProps.onSelectExistingEvent !== nextProps.onSelectExistingEvent)
      return false;
    if (prevProps.onComposerOpenChange !== nextProps.onComposerOpenChange)
      return false;
    if (
      prevProps.onComposerStartQuarterChange !==
      nextProps.onComposerStartQuarterChange
    ) {
      return false;
    }
    if (
      prevProps.onComposerEndQuarterChange !==
      nextProps.onComposerEndQuarterChange
    ) {
      return false;
    }
    if (prevProps.onComposerSave !== nextProps.onComposerSave) return false;
    if (prevProps.onComposerDelete !== nextProps.onComposerDelete) return false;
    if (prevProps.eightAmRowRef !== nextProps.eightAmRowRef) return false;

    const prevIsSelected = quarterInSelection(
      prevProps.activeSelection,
      prevProps.quarter,
    );
    const nextIsSelected = quarterInSelection(
      nextProps.activeSelection,
      nextProps.quarter,
    );
    if (prevIsSelected !== nextIsSelected) return false;

    const prevIsDraft = quarterInComposer(
      prevProps.composerSession,
      prevProps.quarter,
    );
    const nextIsDraft = quarterInComposer(
      nextProps.composerSession,
      nextProps.quarter,
    );
    if (prevIsDraft !== nextIsDraft) return false;

    const prevIsComposerStart = quarterIsComposerStart(
      prevProps.composerSession,
      prevProps.quarter,
    );
    const nextIsComposerStart = quarterIsComposerStart(
      nextProps.composerSession,
      nextProps.quarter,
    );
    if (prevIsComposerStart !== nextIsComposerStart) return false;

    if (prevIsComposerStart || nextIsComposerStart) {
      if (prevProps.composerSession !== nextProps.composerSession) return false;
      if (prevProps.composerDayText !== nextProps.composerDayText) return false;
      if (prevProps.composerRangeText !== nextProps.composerRangeText)
        return false;
      if (prevProps.creatingItem !== nextProps.creatingItem) return false;
      if (prevProps.deletingItem !== nextProps.deletingItem) return false;
    }

    return true;
  },
);
