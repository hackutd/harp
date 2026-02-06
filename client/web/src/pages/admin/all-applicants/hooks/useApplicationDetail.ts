import { useEffect, useState } from 'react';

import { errorAlert,getRequest } from '@/shared/lib/api';
import type { Application } from '@/types';

interface UseApplicationDetailResult {
  detail: Application | null;
  loading: boolean;
  clear: () => void;
}

export function useApplicationDetail(applicationId: string | null): UseApplicationDetailResult {
  const [detail, setDetail] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!applicationId) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      const res = await getRequest<Application>(
        `/v1/admin/applications/${applicationId}`,
        'application'
      );
      if (cancelled) return;

      if (res.status === 200 && res.data) {
        setDetail(res.data);
      } else {
        errorAlert(res);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const clear = () => {
    setDetail(null);
  };

  return { detail, loading, clear };
}
