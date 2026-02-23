import { useEffect, useState } from "react";

import { errorAlert, getRequest } from "@/shared/lib/api";
import type { Application } from "@/types";

interface UseApplicationDetailResult {
  detail: Application | null;
  loading: boolean;
  clear: () => void;
}

export function useApplicationDetail(
  applicationId: string | null,
): UseApplicationDetailResult {
  const [detail, setDetail] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!applicationId) {
      return;
    }

    const controller = new AbortController();

    (async () => {
      setLoading(true);
      const res = await getRequest<Application>(
        `/admin/applications/${applicationId}`,
        "application",
        controller.signal,
      );
      if (controller.signal.aborted) return;

      if (res.status === 200 && res.data) {
        setDetail(res.data);
      } else {
        errorAlert(res);
      }
      setLoading(false);
    })();

    return () => {
      controller.abort();
    };
  }, [applicationId]);

  const clear = () => {
    setDetail(null);
  };

  return { detail, loading, clear };
}
