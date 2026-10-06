import { toast } from "sonner";
import { create } from "zustand";

import { errorAlert } from "@/shared/lib/api";

import {
  fetchDecisionsReleased as apiFetchDecisionsReleased,
  setDecisionsReleased as apiSetDecisionsReleased,
} from "./api";

interface DecisionReleaseState {
  /** null until the first successful load. */
  released: boolean | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetchReleased: (signal?: AbortSignal) => Promise<void>;
  /** Resolves true when the server accepted the change. */
  setReleased: (released: boolean) => Promise<boolean>;
}

// Drops a load that lands after a newer load or a save has already answered.
let requestSeq = 0;

export const useDecisionReleaseStore = create<DecisionReleaseState>((set) => ({
  released: null,
  loading: false,
  saving: false,
  error: null,

  fetchReleased: async (signal) => {
    const seq = ++requestSeq;
    set({ loading: true, error: null });
    const res = await apiFetchDecisionsReleased(signal);
    if (signal?.aborted || seq !== requestSeq) return;
    if (res.status === 200 && res.data) {
      set({ released: res.data.released, loading: false });
    } else {
      set({
        loading: false,
        error: res.error || "Unable to load whether decisions are released.",
      });
    }
  },

  setReleased: async (released) => {
    const seq = ++requestSeq;
    set({ saving: true });
    const res = await apiSetDecisionsReleased(released);
    if (res.status === 200 && res.data) {
      set({ released: res.data.released, saving: false, error: null });
      toast.success(
        res.data.released
          ? "Decisions released. Hackers can now see their results."
          : "Decisions hidden. Hackers see their application as under review.",
      );
      return true;
    }
    set({ saving: false });
    errorAlert(res);
    // The write may have committed before the failure, so reload the truth.
    if (seq === requestSeq) {
      void useDecisionReleaseStore.getState().fetchReleased();
    }
    return false;
  },
}));
