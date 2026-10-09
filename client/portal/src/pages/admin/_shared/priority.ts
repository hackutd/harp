import { useEffect } from "react";
import { create } from "zustand";

import { getRequest } from "@/shared/lib/api";

interface PriorityDeadlineResponse {
  deadline: string | null;
}

/**
 * The priority deadline set by a super admin: applications submitted by this
 * instant count as priority. Read once per session and shared by every badge.
 */
interface PriorityDeadlineState {
  deadline: Date | null;
  /** True once a fetch has settled, successfully or not. */
  loaded: boolean;
  fetchDeadline: () => Promise<void>;
  /** Apply a deadline just saved in settings without refetching. */
  setDeadline: (deadline: string | null) => void;
}

function parseDeadline(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// A table renders a badge per row; they share one request.
let inFlight: Promise<void> | null = null;

export const usePriorityDeadlineStore = create<PriorityDeadlineState>(
  (set) => ({
    deadline: null,
    loaded: false,
    fetchDeadline: () => {
      inFlight ??= (async () => {
        const res = await getRequest<PriorityDeadlineResponse>(
          "/admin/settings/priority-deadline",
          "priority deadline",
        );
        // A badge is not worth an error toast on every admin page: without
        // the deadline, nothing is marked priority.
        set({
          deadline:
            res.status === 200 && res.data
              ? parseDeadline(res.data.deadline)
              : null,
          loaded: true,
        });
        inFlight = null;
      })();
      return inFlight;
    },
    setDeadline: (deadline) =>
      set({ deadline: parseDeadline(deadline), loaded: true }),
  }),
);

/** The priority deadline, fetched on first use; null while loading or unset. */
export function usePriorityDeadline(): Date | null {
  const deadline = usePriorityDeadlineStore((s) => s.deadline);
  const loaded = usePriorityDeadlineStore((s) => s.loaded);
  const fetchDeadline = usePriorityDeadlineStore((s) => s.fetchDeadline);

  useEffect(() => {
    if (!loaded) void fetchDeadline();
  }, [loaded, fetchDeadline]);

  return deadline;
}

export function isPriorityApplication(
  submittedAt: string | null | undefined,
  deadline: Date | null,
): boolean {
  if (!submittedAt || !deadline) return false;
  const submitted = new Date(submittedAt);
  return !Number.isNaN(submitted.getTime()) && submitted <= deadline;
}
