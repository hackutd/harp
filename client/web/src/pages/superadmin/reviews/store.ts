import { create } from "zustand";

import {
  fetchApplications as apiFetchApplications,
  fetchApplicationStats,
} from "@/pages/admin/all-applicants/api";
import type {
  ApplicationListItem,
  ApplicationSortBy,
  ApplicationStats,
  ApplicationStatus,
  FetchParams,
} from "@/pages/admin/all-applicants/types";

export interface ReviewApplicationsState {
  applications: ApplicationListItem[];
  loading: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  currentStatus: ApplicationStatus;
  currentSearch: string;
  currentSortBy: ApplicationSortBy;
  stats: ApplicationStats | null;
  statsLoading: boolean;
  fetchApplications: (
    params?: FetchParams,
    signal?: AbortSignal,
  ) => Promise<void>;
  fetchStats: (signal?: AbortSignal) => Promise<void>;
}

export const useReviewApplicationsStore = create<ReviewApplicationsState>(
  (set, get) => ({
    applications: [],
    loading: false,
    nextCursor: null,
    prevCursor: null,
    hasMore: false,
    currentStatus: "submitted",
    currentSearch: "",
    currentSortBy: "created_at",
    stats: null,
    statsLoading: false,

    fetchApplications: async (params?: FetchParams, signal?: AbortSignal) => {
      set({ loading: true });

      let status: ApplicationStatus;
      if (params && "status" in params && params.status) {
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

      let sortBy: ApplicationSortBy;
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
          sort_by: sortBy !== "created_at" ? sortBy : undefined,
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
  }),
);
