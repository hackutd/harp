import { toast } from "sonner";
import { create } from "zustand";

import {
  fetchApplicationById,
  fetchApplications as apiFetchApplications,
} from "@/pages/admin/all-applicants/api";
import type {
  ApplicationListItem,
  ApplicationSortBy,
  ApplicationStatus,
  FetchParams,
} from "@/pages/admin/all-applicants/types";
import { fetchReviewNotes } from "@/pages/admin/assigned/api";
import type { ReviewNote } from "@/pages/admin/assigned/types";
import type { Application } from "@/types";

import { setApplicationStatus } from "./api";

interface FilterParams {
  status?: ApplicationStatus;
  sort_by?: ApplicationSortBy;
  search?: string;
}

interface GradingState {
  applications: ApplicationListItem[];
  loading: boolean;
  currentIndex: number;
  detail: Application | null;
  detailLoading: boolean;
  notes: ReviewNote[];
  notesLoading: boolean;
  grading: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  filterParams: FilterParams;
  fetchApplications: (params?: FetchParams) => Promise<void>;
  loadDetail: (applicationId: string) => Promise<void>;
  navigateNext: () => void;
  navigatePrev: () => void;
  gradeApplication: (
    applicationId: string,
    status: "accepted" | "rejected" | "waitlisted",
  ) => Promise<void>;
  reset: () => void;
}

const initialState = {
  applications: [] as ApplicationListItem[],
  loading: false,
  currentIndex: 0,
  detail: null as Application | null,
  detailLoading: false,
  notes: [] as ReviewNote[],
  notesLoading: false,
  grading: false,
  nextCursor: null as string | null,
  prevCursor: null as string | null,
  filterParams: {} as FilterParams,
};

let loadDetailSeq = 0;

export const useGradingStore = create<GradingState>((set, get) => ({
  ...initialState,

  fetchApplications: async (params?: FetchParams) => {
    set({ loading: true });

    const state = get();
    const mergedParams: FetchParams = {
      status: state.filterParams.status ?? "submitted",
      sort_by: state.filterParams.sort_by ?? "accept_votes",
      search: state.filterParams.search || undefined,
      ...params,
    };

    const res = await apiFetchApplications(mergedParams);

    if (res.status === 200 && res.data) {
      set({
        applications: res.data.applications,
        nextCursor: res.data.next_cursor,
        prevCursor: res.data.prev_cursor,
        loading: false,
        filterParams: {
          status: mergedParams.status ?? undefined,
          sort_by: mergedParams.sort_by,
          search: mergedParams.search,
        },
      });
    } else {
      set({
        applications: [],
        nextCursor: null,
        prevCursor: null,
        loading: false,
      });
    }
  },

  loadDetail: async (applicationId: string) => {
    const requestId = ++loadDetailSeq;
    set({
      detailLoading: true,
      notesLoading: true,
      detail: null,
      notes: [],
    });

    const [detailRes, notesRes] = await Promise.all([
      fetchApplicationById(applicationId),
      fetchReviewNotes(applicationId),
    ]);

    // Guard against stale responses from rapid navigation
    if (loadDetailSeq !== requestId) return;

    if (detailRes.status === 200 && detailRes.data) {
      set({ detail: detailRes.data, detailLoading: false });
    } else {
      set({ detail: null, detailLoading: false });
    }

    if (notesRes.status === 200 && notesRes.data) {
      set({ notes: notesRes.data.notes ?? [], notesLoading: false });
    } else {
      set({ notes: [], notesLoading: false });
    }
  },

  navigateNext: () => {
    const { applications, currentIndex, nextCursor } = get();
    if (currentIndex < applications.length - 1) {
      const newIndex = currentIndex + 1;
      set({ currentIndex: newIndex });
      get().loadDetail(applications[newIndex].id);
    } else if (nextCursor) {
      get()
        .fetchApplications({ cursor: nextCursor })
        .then(() => {
          const newApps = get().applications;
          if (newApps.length > 0) {
            set({ currentIndex: 0 });
            get().loadDetail(newApps[0].id);
          }
        })
        .catch(() => {});
    }
  },

  navigatePrev: () => {
    const { applications, currentIndex, prevCursor } = get();
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      set({ currentIndex: newIndex });
      get().loadDetail(applications[newIndex].id);
    } else if (prevCursor) {
      get()
        .fetchApplications({ cursor: prevCursor, direction: "backward" })
        .then(() => {
          const newApps = get().applications;
          if (newApps.length > 0) {
            const lastIndex = newApps.length - 1;
            set({ currentIndex: lastIndex });
            get().loadDetail(newApps[lastIndex].id);
          }
        })
        .catch(() => {});
    }
  },

  gradeApplication: async (
    applicationId: string,
    status: "accepted" | "rejected" | "waitlisted",
  ) => {
    set({ grading: true });

    const res = await setApplicationStatus(applicationId, status);

    if (res.status === 200) {
      const { applications, currentIndex } = get();
      const updated = applications.map((app) =>
        app.id === applicationId ? { ...app, status } : app,
      );
      set({ applications: updated, grading: false });

      toast.success(`Application ${status}`);

      // Auto-advance to next
      if (currentIndex < updated.length - 1) {
        const newIndex = currentIndex + 1;
        set({ currentIndex: newIndex });
        get().loadDetail(updated[newIndex].id);
      } else if (get().nextCursor) {
        get().navigateNext();
      }
    } else {
      set({ grading: false });
      toast.error(res.error ?? "Failed to update application status");
    }
  },

  reset: () => {
    loadDetailSeq = 0;
    set(initialState);
  },
}));
