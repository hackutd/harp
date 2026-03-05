import type { ScheduleResponseItem } from "../api";
import { QUARTER_HOUR_SLOTS } from "../constants";
import type { ScheduleItem } from "../types";
import { getDatePartsInChicago, toInputDateValue } from "../utils";

export function mapScheduleItemsToGrid(
  items: ScheduleResponseItem[],
  scheduleDays: Date[],
): ScheduleItem[] {
  const dayIndexByDateKey = new Map(
    scheduleDays.map((day, index) => [toInputDateValue(day), index]),
  );

  return items.flatMap((item) => {
    const startTime = new Date(item.start_time);
    const endTime = new Date(item.end_time);

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      return [];
    }

    const startParts = getDatePartsInChicago(startTime);
    const endParts = getDatePartsInChicago(endTime);

    if (startParts.dateKey !== endParts.dateKey) {
      return [];
    }

    const dayIndex = dayIndexByDateKey.get(startParts.dateKey);
    if (dayIndex === undefined) {
      return [];
    }

    const startQuarter =
      startParts.hour * 4 + Math.floor(startParts.minute / 15);
    const endQuarterRaw =
      endParts.hour * 4 +
      (endParts.minute === 0 ? 0 : Math.ceil(endParts.minute / 15));
    const endQuarter = Math.min(
      QUARTER_HOUR_SLOTS,
      Math.max(endQuarterRaw, startQuarter + 1),
    );

    if (startQuarter >= QUARTER_HOUR_SLOTS) {
      return [];
    }

    return [
      {
        id: item.id,
        dayIndex,
        startQuarter,
        endQuarter,
        title: item.event_name,
        location: item.location,
        details: item.description,
        tags: item.tags ?? [],
      },
    ];
  });
}
