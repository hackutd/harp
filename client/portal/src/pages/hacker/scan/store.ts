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

interface ScannerState {
  scanTypes: ScanType[];
  stats: ScanStat[];
  loading: boolean;
  scanning: boolean;
  activeScanType: ScanType | null;
  lastScanResult: ScanResult | null;

  fetchScannerData: (signal?: AbortSignal) => Promise<void>;
  performScan: (userId: string) => Promise<void>;
  setActiveScanType: (scanType: ScanType | null) => void;
  clearLastResult: () => void;
}

export const useScannerStore = create<ScannerState>((set, get) => ({
  scanTypes: [],
  stats: [],
  loading: false,
  scanning: false,
  activeScanType: null,
  lastScanResult: null,

  fetchScannerData: async (signal?: AbortSignal) => {
    set({ loading: true });

    const [typesRes, statsRes] = await Promise.all([
      fetchScanTypes(signal),
      fetchScanStats(signal),
    ]);

    if (signal?.aborted) return;

    set({
      scanTypes:
        typesRes.status === 200 && typesRes.data
          ? typesRes.data.scan_types
          : [],
      stats:
        statsRes.status === 200 && statsRes.data ? statsRes.data.stats : [],
      loading: false,
    });
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
      // Refresh counts after a successful scan
      const statsRes = await fetchScanStats();
      if (statsRes.status === 200 && statsRes.data) {
        set({ stats: statsRes.data.stats });
      }
    } else {
      let message = res.error || "Failed to create scan";
      if (res.status === 404) {
        message = "User not found — QR code not recognized";
      } else if (res.status === 409) {
        message = `Already scanned for ${activeScanType.display_name}`;
      } else if (res.status === 403) {
        message = "User must check in first";
      } else if (res.status === 402) {
        message = res.error || "Insufficient points";
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
