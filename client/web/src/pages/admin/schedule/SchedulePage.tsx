import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ScheduleGrid } from "./components/ScheduleGrid";
import { ScheduleHeaderCard } from "./components/ScheduleHeaderCard";
import { DEFAULT_SCHEDULE_TAGS, QUARTER_HOUR_SLOTS } from "./constants";
import { useScheduleCrud } from "./hooks/useScheduleCrud";
import { useScheduleData } from "./hooks/useScheduleData";
import { useScheduleEventIndex } from "./hooks/useScheduleEventIndex";
import { useScheduleSelection } from "./hooks/useScheduleSelection";
import type {
  ScheduleComposerSession,
  ScheduleComposerValues,
  ScheduleItem,
} from "./types";
import { formatDayHeader, formatQuarterTime } from "./utils";

const EMPTY_COMPOSER_VALUES: ScheduleComposerValues = {
  title: "",
  location: "",
  details: "",
  tag: "",
  isOtherTagSelected: false,
  otherTagValue: "",
};

function getInitialValuesFromScheduleItem(
  item: ScheduleItem,
): ScheduleComposerValues {
  const tag = item.tags[0] ?? "";
  const isPresetTag = DEFAULT_SCHEDULE_TAGS.includes(
    tag as (typeof DEFAULT_SCHEDULE_TAGS)[number],
  );

  if (!tag || isPresetTag) {
    return {
      title: item.title,
      location: item.location,
      details: item.details,
      tag,
      isOtherTagSelected: false,
      otherTagValue: "",
    };
  }

  return {
    title: item.title,
    location: item.location,
    details: item.details,
    tag,
    isOtherTagSelected: true,
    otherTagValue: tag,
  };
}

export default function SchedulePage() {
  const {
    loading,
    schedulingEnabled,
    configuredStartDate,
    configuredEndDate,
    scheduleDays,
    scheduleItems,
    setScheduleItems,
  } = useScheduleData();

  const { getStartsAt } = useScheduleEventIndex(scheduleItems);

  const {
    creatingItem,
    deletingItem,
    saveScheduleItem,
    deleteScheduleItemByID,
  } = useScheduleCrud({
    scheduleDays,
    setScheduleItems,
  });

  const [composerSession, setComposerSession] =
    useState<ScheduleComposerSession | null>(null);

  const hasAutoScrolledRef = useRef(false);
  const eightAmRowRef = useRef<HTMLSpanElement | null>(null);
  const sessionCounterRef = useRef(0);

  const closeComposer = useCallback(() => {
    setComposerSession(null);
  }, []);

  const openComposerForRange = useCallback(
    (dayIndex: number, startQuarter: number, endQuarter: number) => {
      if (!schedulingEnabled) return;

      const boundedStart = Math.max(
        0,
        Math.min(startQuarter, QUARTER_HOUR_SLOTS - 1),
      );
      const boundedEnd = Math.max(
        boundedStart + 1,
        Math.min(endQuarter, QUARTER_HOUR_SLOTS),
      );

      sessionCounterRef.current += 1;
      setComposerSession({
        sessionID: sessionCounterRef.current,
        mode: "create",
        itemID: null,
        dayIndex,
        startQuarter: boundedStart,
        endQuarter: boundedEnd,
        initialValues: EMPTY_COMPOSER_VALUES,
      });
    },
    [schedulingEnabled],
  );

  const {
    activeSelection,
    clearSelection,
    onCellMouseDown,
    onCellMouseEnter,
    onCellDoubleClick,
  } = useScheduleSelection({
    enabled: schedulingEnabled,
    onCommitRange: openComposerForRange,
  });

  const handleSelectScheduleItemForEdit = useCallback(
    (item: ScheduleItem) => {
      clearSelection();

      sessionCounterRef.current += 1;
      setComposerSession({
        sessionID: sessionCounterRef.current,
        mode: "edit",
        itemID: item.id,
        dayIndex: item.dayIndex,
        startQuarter: item.startQuarter,
        endQuarter: item.endQuarter,
        initialValues: getInitialValuesFromScheduleItem(item),
      });
    },
    [clearSelection],
  );

  const handleComposerStartQuarterChange = useCallback((value: string) => {
    const nextStart = Number(value);
    if (Number.isNaN(nextStart)) return;

    setComposerSession((current) => {
      if (!current) return null;

      const boundedStart = Math.max(
        0,
        Math.min(nextStart, QUARTER_HOUR_SLOTS - 1),
      );
      const nextEnd = Math.max(current.endQuarter, boundedStart + 1);

      return {
        ...current,
        startQuarter: boundedStart,
        endQuarter: Math.min(nextEnd, QUARTER_HOUR_SLOTS),
      };
    });
  }, []);

  const handleComposerEndQuarterChange = useCallback((value: string) => {
    const nextEnd = Number(value);
    if (Number.isNaN(nextEnd)) return;

    setComposerSession((current) => {
      if (!current) return null;

      const boundedEnd = Math.max(
        current.startQuarter + 1,
        Math.min(nextEnd, QUARTER_HOUR_SLOTS),
      );

      return {
        ...current,
        endQuarter: boundedEnd,
      };
    });
  }, []);

  const handleComposerSave = useCallback(
    async (values: ScheduleComposerValues) => {
      if (!composerSession || !schedulingEnabled) return;

      const didSave = await saveScheduleItem(composerSession, values);
      if (!didSave) return;

      closeComposer();
      clearSelection();
    },
    [
      clearSelection,
      closeComposer,
      composerSession,
      saveScheduleItem,
      schedulingEnabled,
    ],
  );

  const handleComposerDelete = useCallback(async () => {
    if (!composerSession || composerSession.mode !== "edit") return;

    const didDelete = await deleteScheduleItemByID(composerSession.itemID);
    if (!didDelete) return;

    closeComposer();
    clearSelection();
  }, [clearSelection, closeComposer, composerSession, deleteScheduleItemByID]);

  const handleComposerOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      closeComposer();
      clearSelection();
    },
    [clearSelection, closeComposer],
  );

  const composerRangeText = useMemo(() => {
    if (!composerSession) return "";
    return `${formatQuarterTime(composerSession.startQuarter)} - ${formatQuarterTime(
      composerSession.endQuarter,
    )}`;
  }, [composerSession]);

  const composerDayText = useMemo(() => {
    if (!composerSession) return "";
    const day = scheduleDays[composerSession.dayIndex];
    return day ? formatDayHeader(day) : "";
  }, [composerSession, scheduleDays]);

  useEffect(() => {
    if (!schedulingEnabled) {
      hasAutoScrolledRef.current = false;
      return;
    }

    if (hasAutoScrolledRef.current) return;

    const animationFrame = window.requestAnimationFrame(() => {
      eightAmRowRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
      hasAutoScrolledRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [schedulingEnabled, scheduleDays.length]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <ScheduleHeaderCard
        loading={loading}
        schedulingEnabled={schedulingEnabled}
        configuredStartDate={configuredStartDate}
        configuredEndDate={configuredEndDate}
        scheduleDaysLength={scheduleDays.length}
      />

      {schedulingEnabled ? (
        <ScheduleGrid
          scheduleDays={scheduleDays}
          activeSelection={activeSelection}
          composerSession={composerSession}
          composerDayText={composerDayText}
          composerRangeText={composerRangeText}
          creatingItem={creatingItem}
          deletingItem={deletingItem}
          getStartsAt={getStartsAt}
          onSelectExistingEvent={handleSelectScheduleItemForEdit}
          onCellMouseDown={onCellMouseDown}
          onCellMouseEnter={onCellMouseEnter}
          onCellDoubleClick={onCellDoubleClick}
          onComposerOpenChange={handleComposerOpenChange}
          onComposerStartQuarterChange={handleComposerStartQuarterChange}
          onComposerEndQuarterChange={handleComposerEndQuarterChange}
          onComposerSave={handleComposerSave}
          onComposerDelete={handleComposerDelete}
          eightAmRowRef={eightAmRowRef}
        />
      ) : null}
    </div>
  );
}
