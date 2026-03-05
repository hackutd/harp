import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { errorAlert } from "@/shared/lib/api";

import { fetchScheduleDateRange, fetchScheduleItems } from "../api";
import { mapScheduleItemsToGrid } from "../mappers/mapScheduleItemsToGrid";
import type { ScheduleItem } from "../types";
import { getDateRange, parseDate, startOfDay } from "../utils";

type UseScheduleDataResult = {
  loading: boolean;
  schedulingEnabled: boolean;
  configuredStartDate: string | null;
  configuredEndDate: string | null;
  scheduleDays: Date[];
  scheduleItems: ScheduleItem[];
  setScheduleItems: Dispatch<SetStateAction<ScheduleItem[]>>;
};

export function useScheduleData(): UseScheduleDataResult {
  const [loading, setLoading] = useState(true);
  const [rangeConfigured, setRangeConfigured] = useState(false);
  const [configuredStartDate, setConfiguredStartDate] = useState<string | null>(
    null,
  );
  const [configuredEndDate, setConfiguredEndDate] = useState<string | null>(
    null,
  );
  const [scheduleDays, setScheduleDays] = useState<Date[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchScheduleData() {
      setLoading(true);

      const [rangeRes, scheduleRes] = await Promise.all([
        fetchScheduleDateRange(controller.signal),
        fetchScheduleItems(controller.signal),
      ]);

      if (controller.signal.aborted) {
        return;
      }

      if (rangeRes.status === 200 && rangeRes.data) {
        const configured =
          rangeRes.data.configured &&
          !!rangeRes.data.start_date &&
          !!rangeRes.data.end_date;

        setRangeConfigured(configured);
        setConfiguredStartDate(rangeRes.data.start_date);
        setConfiguredEndDate(rangeRes.data.end_date);

        if (configured) {
          const start = parseDate(rangeRes.data.start_date!);
          const end = parseDate(rangeRes.data.end_date!);

          if (!start || !end || end < start) {
            setRangeConfigured(false);
            setScheduleDays([]);
            setScheduleItems([]);
            toast.error("Configured hackathon date range is invalid.");
          } else {
            const nextDays = getDateRange(startOfDay(start), startOfDay(end));
            setScheduleDays(nextDays);

            if (scheduleRes.status === 200 && scheduleRes.data) {
              setScheduleItems(
                mapScheduleItemsToGrid(scheduleRes.data.schedule, nextDays),
              );
            } else {
              setScheduleItems([]);
              errorAlert(scheduleRes);
            }
          }
        } else {
          setScheduleDays([]);
          setScheduleItems([]);
        }
      } else {
        setRangeConfigured(false);
        setConfiguredStartDate(null);
        setConfiguredEndDate(null);
        setScheduleDays([]);
        setScheduleItems([]);
        errorAlert(rangeRes);
      }

      setLoading(false);
    }

    fetchScheduleData();

    return () => {
      controller.abort();
    };
  }, []);

  const schedulingEnabled = useMemo(
    () => rangeConfigured && scheduleDays.length > 0,
    [rangeConfigured, scheduleDays.length],
  );

  return {
    loading,
    schedulingEnabled,
    configuredStartDate,
    configuredEndDate,
    scheduleDays,
    scheduleItems,
    setScheduleItems,
  };
}
