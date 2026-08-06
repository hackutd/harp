import { create } from "zustand";

import { getRequest } from "@/shared/lib/api";

interface PointsNameResponse {
  name: string;
}

// Display name of the points system (e.g. "HackBucks"), configured by super
// admins and shown to hackers and admins alike.
export interface PointsNameState {
  pointsName: string;
  loading: boolean;
  fetchPointsName: (signal?: AbortSignal) => Promise<void>;
  setPointsName: (name: string) => void;
}

// Matches the backend default when the setting has never been configured.
const DEFAULT_POINTS_NAME = "Points";

export const usePointsNameStore = create<PointsNameState>((set) => ({
  pointsName: DEFAULT_POINTS_NAME,
  loading: false,
  fetchPointsName: async (signal) => {
    set({ loading: true });
    const res = await getRequest<PointsNameResponse>(
      "/points-name",
      "points name",
      signal,
    );
    if (signal?.aborted) return;
    if (res.status === 200 && res.data) {
      set({ pointsName: res.data.name, loading: false });
    } else {
      // A missing label shouldn't surface an error on every page that shows
      // points — keep the default and move on.
      set({ loading: false });
    }
  },
  setPointsName: (name) => set({ pointsName: name }),
}));
