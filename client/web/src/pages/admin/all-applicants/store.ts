import { create } from "zustand";

import { fetchApplications as apiFetchApplications, fetchApplicationStats } from "./api";
import type { ApplicationListItem, ApplicationStats, ApplicationStatus, FetchParams } from "./types";

export interface ApplicationsState {
  applications: ApplicationListItem[];
  loading: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  currentStatus: ApplicationStatus | null;
  stats: ApplicationStats | null;
  statsLoading: boolean;
  fetchApplications: (params?: FetchParams, signal?: AbortSignal) => Promise<void>;
  fetchStats: (signal?: AbortSignal) => Promise<void>;
  setStatusFilter: (status: ApplicationStatus | null) => void;
  resetPagination: () => void;
}

export const useApplicationsStore = create<ApplicationsState>((set, get) => ({
  applications: [],
  loading: false,
  nextCursor: null,
  prevCursor: null,
  hasMore: false,
  currentStatus: null,
  stats: null,
  statsLoading: false,

  fetchApplications: async (params?: FetchParams, signal?: AbortSignal) => {
    set({ loading: true });

    // Determine status to use
    let status: ApplicationStatus | null;
    if (params && 'status' in params) {
      status = params.status ?? null;
    } else {
      status = get().currentStatus;
    }

    const res = await apiFetchApplications({
      ...params,
      status,
    }, signal);

    if (signal?.aborted) return;

    if (res.status === 200 && res.data) {
      set({
        applications: res.data.applications,
        nextCursor: res.data.next_cursor,
        prevCursor: res.data.prev_cursor,
        hasMore: res.data.has_more,
        loading: false,
        currentStatus: status,
      });
    } else {
      set({
        applications: [],
        nextCursor: null,
        prevCursor: null,
        hasMore: false,
        loading: false,
      });
    }
  },

  fetchStats: async (signal?: AbortSignal) => {
    set({ statsLoading: true });

    const res = await fetchApplicationStats(signal);

    if (signal?.aborted) return;

    if (res.status === 200 && res.data) {
      set({ stats: res.data, statsLoading: false });
    } else {
      set({ stats: null, statsLoading: false });
    }
  },

  setStatusFilter: (status) => {
    set({ currentStatus: status });
  },

  resetPagination: () => {
    set({
      applications: [],
      nextCursor: null,
      prevCursor: null,
      hasMore: false,
      currentStatus: null,
    });
  },
}));
