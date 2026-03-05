import { type RefObject } from "react";

import { Card, CardContent } from "@/components/ui/card";

import { QUARTER_HOUR_SLOTS } from "../constants";
import type {
  ScheduleComposerSession,
  ScheduleComposerValues,
  ScheduleItem,
  SelectionRange,
} from "../types";
import { formatDayHeader } from "../utils";
import { ScheduleGridRow } from "./grid/ScheduleGridRow";

type ScheduleGridProps = {
  scheduleDays: Date[];
  activeSelection: SelectionRange | null;
  composerSession: ScheduleComposerSession | null;
  composerDayText: string;
  composerRangeText: string;
  creatingItem: boolean;
  deletingItem: boolean;
  getStartsAt: (dayIndex: number, quarter: number) => readonly ScheduleItem[];
  onSelectExistingEvent: (item: ScheduleItem) => void;
  onCellMouseDown: (dayIndex: number, quarter: number, button: number) => void;
  onCellMouseEnter: (dayIndex: number, quarter: number) => void;
  onCellDoubleClick: (dayIndex: number, quarter: number) => void;
  onComposerOpenChange: (open: boolean) => void;
  onComposerStartQuarterChange: (value: string) => void;
  onComposerEndQuarterChange: (value: string) => void;
  onComposerSave: (values: ScheduleComposerValues) => Promise<void>;
  onComposerDelete: () => Promise<void>;
  eightAmRowRef?: RefObject<HTMLSpanElement | null>;
};

export function ScheduleGrid({
  scheduleDays,
  activeSelection,
  composerSession,
  composerDayText,
  composerRangeText,
  creatingItem,
  deletingItem,
  getStartsAt,
  onSelectExistingEvent,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onComposerOpenChange,
  onComposerStartQuarterChange,
  onComposerEndQuarterChange,
  onComposerSave,
  onComposerDelete,
  eightAmRowRef,
}: ScheduleGridProps) {
  return (
    <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
      <CardContent className="h-full overflow-auto p-0">
        <div
          className="grid min-w-[760px] select-none"
          style={{
            gridTemplateColumns: `72px repeat(${scheduleDays.length}, minmax(160px, 1fr))`,
          }}
        >
          <div className="bg-muted/30 sticky top-0 left-0 z-40 border-r border-b p-3" />
          {scheduleDays.map((day) => (
            <div
              key={day.toISOString()}
              className="bg-muted/30 sticky top-0 z-30 border-b p-3 text-center text-sm font-medium"
            >
              {formatDayHeader(day)}
            </div>
          ))}

          {Array.from({ length: QUARTER_HOUR_SLOTS }).map((_, quarter) => (
            <ScheduleGridRow
              key={quarter}
              quarter={quarter}
              scheduleDays={scheduleDays}
              activeSelection={activeSelection}
              composerSession={composerSession}
              composerDayText={composerDayText}
              composerRangeText={composerRangeText}
              creatingItem={creatingItem}
              deletingItem={deletingItem}
              getStartsAt={getStartsAt}
              onCellMouseDown={onCellMouseDown}
              onCellMouseEnter={onCellMouseEnter}
              onCellDoubleClick={onCellDoubleClick}
              onSelectExistingEvent={onSelectExistingEvent}
              onComposerOpenChange={onComposerOpenChange}
              onComposerStartQuarterChange={onComposerStartQuarterChange}
              onComposerEndQuarterChange={onComposerEndQuarterChange}
              onComposerSave={onComposerSave}
              onComposerDelete={onComposerDelete}
              eightAmRowRef={quarter === 32 ? eightAmRowRef : undefined}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
