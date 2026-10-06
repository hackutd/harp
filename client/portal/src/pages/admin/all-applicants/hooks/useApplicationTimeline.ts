import { useEffect, useState } from "react";

import { fetchApplicationTimeline } from "../api";
import { browserTimeZone } from "../timeline";
import type { ApplicationTimelinePoint } from "../types";

interface UseApplicationTimelineResult {
  points: ApplicationTimelinePoint[];
  timeZone: string;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the per-day application series once per mount. Range and
 * daily/cumulative switching happen client-side on this one response.
 */
export function useApplicationTimeline(): UseApplicationTimelineResult {
  const [timeZone] = useState(browserTimeZone);
  const [points, setPoints] = useState<ApplicationTimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      const res = await fetchApplicationTimeline(timeZone, controller.signal);
      if (controller.signal.aborted) return;

      if (res.status === 200 && res.data) {
        setPoints(res.data.timeline);
      } else {
        setPoints([]);
        setError(res.error || "Unable to load the application timeline.");
      }
      setLoading(false);
    })();

    return () => controller.abort();
  }, [timeZone]);

  return { points, timeZone, loading, error };
}
