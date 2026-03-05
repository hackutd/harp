import { create } from "zustand";

import {
  createScan as apiCreateScan,
  fetchScanStats,
  fetchScanTypes,
} from "./api";
import type { Scan, ScanStat, ScanType } from "./types";

export interface ScanResult {
  success: boolean;
  message: string;
  scan?: Scan;
}

export interface ScansState {
  scanTypes: ScanType[];
  stats: ScanStat[];
  typesLoading: boolean;
  statsLoading: boolean;
  scanning: boolean;
  activeScanType: ScanType | null;
  lastScanResult: ScanResult | null;

  fetchTypes: (signal?: AbortSignal) => Promise<void>;
  fetchStats: (signal?: AbortSignal) => Promise<void>;
  performScan: (userId: string) => Promise<void>;
  setActiveScanType: (scanType: ScanType | null) => void;
  clearLastResult: () => void;
}

export const useScansStore = create<ScansState>((set, get) => ({
  scanTypes: [],
  stats: [],
  typesLoading: false,
  statsLoading: false,
  scanning: false,
  activeScanType: null,
  lastScanResult: null,

  fetchTypes: async (signal?: AbortSignal) => {
    set({ typesLoading: true });

    const res = await fetchScanTypes(signal);

    if (signal?.aborted) return;

    if (res.status === 200 && res.data) {
      set({ scanTypes: res.data.scan_types, typesLoading: false });
    } else {
      set({ scanTypes: [], typesLoading: false });
    }
  },

  fetchStats: async (signal?: AbortSignal) => {
    set({ statsLoading: true });

    const res = await fetchScanStats(signal);

    if (signal?.aborted) return;

    if (res.status === 200 && res.data) {
      set({ stats: res.data.stats, statsLoading: false });
    } else {
      set({ stats: [], statsLoading: false });
    }
  },

  performScan: async (userId: string) => {
    const { activeScanType, scanning } = get();
    if (!activeScanType || scanning) return;

    set({ scanning: true, lastScanResult: null });

    const res = await apiCreateScan(userId, activeScanType.name);

    if (res.status === 201 && res.data) {
      set({
        scanning: false,
        lastScanResult: {
          success: true,
          message: "Scanned successfully",
          scan: res.data,
        },
      });
      // Refresh stats after successful scan
      get().fetchStats();
    } else {
      let message = res.error || "Failed to create scan";
      if (res.status === 404) {
        message = "User not found — QR code not recognized";
      } else if (res.status === 409) {
        message = `Already scanned for ${activeScanType.display_name}`;
      } else if (res.status === 403) {
        message = "User must check in first";
      }

      set({
        scanning: false,
        lastScanResult: { success: false, message },
      });
    }
  },

  setActiveScanType: (scanType: ScanType | null) => {
    set({ activeScanType: scanType, lastScanResult: null });
  },

  clearLastResult: () => {
    set({ lastScanResult: null });
  },
}));
