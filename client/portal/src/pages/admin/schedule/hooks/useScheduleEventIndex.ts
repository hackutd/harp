import { useCallback, useMemo } from "react";

import type { ScheduleItem } from "../types";

const EMPTY_ITEMS: ScheduleItem[] = [];

export function useScheduleEventIndex(scheduleItems: ScheduleItem[]) {
  const startIndex = useMemo(() => {
    const indexedItems = new Map<number, Map<number, ScheduleItem[]>>();

    for (const item of scheduleItems) {
      let dayMap = indexedItems.get(item.dayIndex);
      if (!dayMap) {
        dayMap = new Map<number, ScheduleItem[]>();
        indexedItems.set(item.dayIndex, dayMap);
      }

      const current = dayMap.get(item.startQuarter);
      if (current) {
        current.push(item);
      } else {
        dayMap.set(item.startQuarter, [item]);
      }
    }

    return indexedItems;
  }, [scheduleItems]);

  const getStartsAt = useCallback(
    (dayIndex: number, quarter: number) => {
      return startIndex.get(dayIndex)?.get(quarter) ?? EMPTY_ITEMS;
    },
    [startIndex],
  );

  return {
    getStartsAt,
  };
}
