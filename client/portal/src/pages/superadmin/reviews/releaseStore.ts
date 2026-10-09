import { toast } from "sonner";
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import {
  createDecisionRelease as apiCreateDecisionRelease,
  fetchDecisionReleases as apiFetchDecisionReleases,
  undoDecisionRelease as apiUndoDecisionRelease,
} from "./api";
import type {
  CreateDecisionReleasePayload,
  CreateDecisionReleaseResponse,
  DecisionRelease,
} from "./types";

interface DecisionReleaseState {
  /** Newest first; null until the first successful load. */
  releases: DecisionRelease[] | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetchReleases: (signal?: AbortSignal) => Promise<void>;
  /** Resolves with the result when the server accepted the release. */
  createRelease: (
    payload: CreateDecisionReleasePayload,
  ) => Promise<CreateDecisionReleaseResponse | null>;
  /** Resolves true when the server undid the release. */
  undoRelease: (id: string) => Promise<boolean>;
}

/** The release an undo would revert: the newest one still in effect. */
export function latestActiveRelease(
  releases: DecisionRelease[] | null,
): DecisionRelease | undefined {
  return releases?.find((release) => !release.undone_at);
}

// Drops a load that lands after a newer load or a write has already answered.
let requestSeq = 0;

export const useDecisionReleaseStore = create<DecisionReleaseState>(
  (set, get) => ({
    releases: null,
    loading: false,
    saving: false,
    error: null,

    fetchReleases: async (signal) => {
      const seq = ++requestSeq;
      set({ loading: true, error: null });
      const res = await apiFetchDecisionReleases(signal);
      if (signal?.aborted || seq !== requestSeq) return;
      if (res.status === 200 && res.data) {
        set({ releases: res.data.releases, loading: false });
      } else {
        set({
          loading: false,
          error: res.error || "Unable to load decision releases.",
        });
      }
    },

    createRelease: async (payload) => {
      ++requestSeq;
      set({ saving: true });
      const res = await apiCreateDecisionRelease(payload);
      set({ saving: false });
      if (res.status !== 201 || !res.data) {
        errorAlert(res);
        return null;
      }

      const { release, emails, email_error } = res.data;
      set({ releases: [release, ...(get().releases ?? [])], error: null });
      const released = `Released ${release.released_count} decision${release.released_count === 1 ? "" : "s"}.`;
      if (email_error) {
        toast.warning(email_error);
      } else if (emails) {
        toast.success(
          `${released} Emailing ${emails.queued} applicant${emails.queued === 1 ? "" : "s"}.`,
        );
      } else {
        toast.success(released);
      }
      // Refresh for the server's view (released-by email, emailed counts).
      void get().fetchReleases();
      return res.data;
    },

    undoRelease: async (id) => {
      const seq = ++requestSeq;
      set({ saving: true });
      const res = await apiUndoDecisionRelease(id);
      if (res.status === 200 && res.data) {
        set({ releases: res.data.releases, saving: false, error: null });
        toast.success(
          "Release undone. Those applicants see what they saw before it.",
        );
        return true;
      }
      set({ saving: false });
      errorAlert(res);
      // The undo may have committed before the failure, so reload the truth.
      if (seq === requestSeq) void get().fetchReleases();
      return false;
    },
  }),
);
