import { create } from "zustand";

import {
  fetchApplications as apiFetchApplications,
  fetchApplicationStats,
} from "./api";
import type {
  ApplicationListItem,
  ApplicationSortBy,
  ApplicationStats,
  ApplicationStatus,
  FetchParams,
} from "./types";

export interface ApplicationsState {
  applications: ApplicationListItem[];
  loading: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  currentStatus: ApplicationStatus | null;
  currentSearch: string;
  currentSortBy?: ApplicationSortBy;
  stats: ApplicationStats | null;
  statsLoading: boolean;
  fetchApplications: (
    params?: FetchParams,
    signal?: AbortSignal,
  ) => Promise<void>;
  fetchStats: (signal?: AbortSignal) => Promise<void>;
  setStatusFilter: (status: ApplicationStatus | null) => void;
  resetPagination: () => void;
}

interface ApplicationsStoreConfig {
  defaultStatus: ApplicationStatus | null;
  defaultSortBy?: ApplicationSortBy;
}

export function createApplicationsStore(config: ApplicationsStoreConfig) {
  return create<ApplicationsState>((set, get) => ({
    applications: [],
    loading: false,
    nextCursor: null,
    prevCursor: null,
    hasMore: false,
    currentStatus: config.defaultStatus,
    currentSearch: "",
    currentSortBy: config.defaultSortBy,
    stats: null,
    statsLoading: false,

    fetchApplications: async (params?: FetchParams, signal?: AbortSignal) => {
      set({ loading: true });

      let status: ApplicationStatus | null;
      if (params && "status" in params && params.status !== undefined) {
        status = params.status;
      } else {
        status = get().currentStatus;
      }

      let search: string;
      if (params && "search" in params) {
        search = params.search ?? "";
      } else {
        search = get().currentSearch;
      }

      let sortBy: ApplicationSortBy | undefined;
      if (params && "sort_by" in params && params.sort_by) {
        sortBy = params.sort_by;
      } else {
        sortBy = get().currentSortBy;
      }

      const res = await apiFetchApplications(
        {
          ...params,
          status,
          search: search || undefined,
          sort_by: sortBy,
        },
        signal,
      );

      if (signal?.aborted) return;

      if (res.status === 200 && res.data) {
        set({
          applications: res.data.applications,
          nextCursor: res.data.next_cursor,
          prevCursor: res.data.prev_cursor,
          hasMore: res.data.has_more,
          loading: false,
          currentStatus: status,
          currentSearch: search,
          currentSortBy: sortBy,
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
        currentStatus: config.defaultStatus,
        currentSearch: "",
        currentSortBy: config.defaultSortBy,
      });
    },
  }));
}
