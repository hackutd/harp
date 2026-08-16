import { create } from "zustand";

import { getRequest } from "@/shared/lib/api";
import { DEFAULT_FEATURE_FLAGS } from "@/shared/lib/feature-defaults";

interface PointsConfigResponse {
  name: string;
  enabled: boolean;
}

// Points system config (display name and whether the system is used at all),
// configured by super admins and read by hackers and admins alike.
export interface PointsConfigState {
  pointsName: string;
  pointsEnabled: boolean;
  loading: boolean;
  fetchPointsConfig: (signal?: AbortSignal) => Promise<void>;
  setPointsName: (name: string) => void;
  setPointsEnabled: (enabled: boolean) => void;
}

// Matches the backend defaults when the settings have never been configured.
const DEFAULT_POINTS_NAME = "Points";

export const usePointsConfigStore = create<PointsConfigState>((set) => ({
  pointsName: DEFAULT_POINTS_NAME,
  pointsEnabled: DEFAULT_FEATURE_FLAGS.pointsEnabled,
  loading: false,
  fetchPointsConfig: async (signal) => {
    set({ loading: true });
    const res = await getRequest<PointsConfigResponse>(
      "/points-config",
      "points config",
      signal,
    );
    if (signal?.aborted) return;
    if (res.status === 200 && res.data) {
      set({
        pointsName: res.data.name,
        pointsEnabled: res.data.enabled,
        loading: false,
      });
    } else {
      // A missing config shouldn't surface an error on every page that shows
      // points — keep the defaults and move on.
      set({ loading: false });
    }
  },
  setPointsName: (name) => set({ pointsName: name }),
  setPointsEnabled: (enabled) => set({ pointsEnabled: enabled }),
}));
