import { useCallback, useEffect, useState } from "react";

import { errorAlert, getRequest } from "@/shared/lib/api";
import type { Application } from "@/types";

interface UseApplicationDetailResult {
  detail: Application | null;
  loading: boolean;
  clear: () => void;
  refresh: () => void;
  error: string | null;
}

export function useApplicationDetail(
  applicationId: string | null,
): UseApplicationDetailResult {
  const [detail, setDetail] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    if (!applicationId) {
      return;
    }

    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setDetail(null);
      setError(null);
      const res = await getRequest<Application>(
        `/admin/applications/${applicationId}`,
        "application",
        controller.signal,
      );
      if (controller.signal.aborted) return;

      if (res.status === 200 && res.data) {
        setDetail(res.data);
      } else {
        setError(res.error || "Unable to load application details.");
        errorAlert(res);
      }
      setLoading(false);
    })();

    return () => {
      controller.abort();
    };
  }, [applicationId, refreshKey]);

  const clear = useCallback(() => {
    setDetail(null);
    setError(null);
  }, []);

  return { detail, loading, clear, refresh, error };
}
