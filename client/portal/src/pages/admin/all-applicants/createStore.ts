import { create } from "zustand";

import type { RSVPStatus } from "@/types";

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
  error: string | null;
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  currentStatus: ApplicationStatus | null;
  currentRSVPStatus: RSVPStatus | null;
  currentCheckedIn: boolean | null;
  currentSearch: string;
  currentSortBy?: ApplicationSortBy;
  stats: ApplicationStats | null;
  statsLoading: boolean;
  statsError: string | null;
  fetchApplications: (
    params?: FetchParams,
    signal?: AbortSignal,
  ) => Promise<void>;
  fetchStats: (signal?: AbortSignal) => Promise<void>;
  setStatusFilter: (status: ApplicationStatus | null) => void;
  resetPagination: () => void;
}

export interface ApplicationsStoreConfig {
  defaultStatus: ApplicationStatus | null;
  defaultSortBy?: ApplicationSortBy;
}

export function createApplicationsStore(config: ApplicationsStoreConfig) {
  let fetchSequence = 0;
  let statsSequence = 0;
  return create<ApplicationsState>((set, get) => ({
    applications: [],
    loading: false,
    error: null,
    nextCursor: null,
    prevCursor: null,
    hasMore: false,
    currentStatus: config.defaultStatus,
    currentRSVPStatus: null,
    currentCheckedIn: null,
    currentSearch: "",
    currentSortBy: config.defaultSortBy,
    stats: null,
    statsLoading: false,
    statsError: null,

    fetchApplications: async (params?: FetchParams, signal?: AbortSignal) => {
      const requestId = ++fetchSequence;
      set({ loading: true, error: null });

      let status: ApplicationStatus | null;
      if (params && "status" in params && params.status !== undefined) {
        status = params.status;
      } else {
        status = get().currentStatus;
      }

      // Like status: null clears the remembered filter, undefined keeps it, so
      // paging and search keep an attendance view applied.
      const rsvpStatus =
        params?.rsvp_status !== undefined
          ? params.rsvp_status
          : get().currentRSVPStatus;
      const checkedIn =
        params?.checked_in !== undefined
          ? params.checked_in
          : get().currentCheckedIn;

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

      // Remember the requested view immediately so retries and assignment
      // refreshes keep filters even while another fetch is pending.
      set({
        currentStatus: status,
        currentRSVPStatus: rsvpStatus,
        currentCheckedIn: checkedIn,
        currentSearch: search,
        currentSortBy: sortBy,
      });
      const res = await apiFetchApplications(
        {
          ...params,
          status,
          rsvp_status: rsvpStatus,
          checked_in: checkedIn,
          search: search || undefined,
          sort_by: sortBy,
        },
        signal,
      );

      if (requestId !== fetchSequence) return;
      if (signal?.aborted) {
        set({ loading: false });
        return;
      }

      if (res.status === 200 && res.data) {
        set({
          applications: res.data.applications,
          nextCursor: res.data.next_cursor,
          prevCursor: res.data.prev_cursor,
          hasMore: res.data.has_more,
          loading: false,
          currentStatus: status,
          currentRSVPStatus: rsvpStatus,
          currentCheckedIn: checkedIn,
          currentSearch: search,
          currentSortBy: sortBy,
        });
      } else {
        set({
          error: res.error || "Unable to load applications. Please try again.",
          applications: [],
          nextCursor: null,
          prevCursor: null,
          hasMore: false,
          loading: false,
        });
      }
    },

    fetchStats: async (signal?: AbortSignal) => {
      const requestId = ++statsSequence;
      set({ statsLoading: true, statsError: null });

      const res = await fetchApplicationStats(signal);

      if (requestId !== statsSequence) return;
      if (signal?.aborted) {
        set({ statsLoading: false });
        return;
      }

      if (res.status === 200 && res.data) {
        set({ stats: res.data, statsLoading: false });
      } else {
        set({
          stats: null,
          statsLoading: false,
          statsError: res.error || "Unable to load application statistics.",
        });
      }
    },

    setStatusFilter: (status) => {
      set({ currentStatus: status });
    },

    resetPagination: () => {
      ++fetchSequence;
      set({
        error: null,
        loading: false,
        applications: [],
        nextCursor: null,
        prevCursor: null,
        hasMore: false,
        currentStatus: config.defaultStatus,
        currentRSVPStatus: null,
        currentCheckedIn: null,
        currentSearch: "",
        currentSortBy: config.defaultSortBy,
      });
    },
  }));
}
