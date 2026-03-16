import { toast } from "sonner";
import { create } from "zustand";

import { fetchApplicationById } from "@/pages/admin/all-applicants/api";
import type { Application } from "@/types";

import {
  fetchPendingReviews,
  fetchReviewNotes,
  submitReviewVote,
} from "../api";
import type { Review, ReviewNote, ReviewVote } from "../types";

interface GradingState {
  reviews: Review[];
  loading: boolean;
  currentIndex: number;
  detail: Application | null;
  detailLoading: boolean;
  notes: ReviewNote[];
  notesLoading: boolean;
  submitting: boolean;
  localNotes: string;
  fetchReviews: () => Promise<void>;
  loadDetail: (applicationId: string) => Promise<void>;
  navigateNext: () => void;
  navigatePrev: () => void;
  submitVote: (reviewId: string, vote: ReviewVote) => Promise<void>;
  setLocalNotes: (notes: string) => void;
  reset: () => void;
}

const initialState = {
  reviews: [] as Review[],
  loading: false,
  currentIndex: 0,
  detail: null as Application | null,
  detailLoading: false,
  notes: [] as ReviewNote[],
  notesLoading: false,
  submitting: false,
  localNotes: "",
};

let loadDetailSeq = 0;

export const useAdminGradingStore = create<GradingState>((set, get) => ({
  ...initialState,

  fetchReviews: async () => {
    set({ loading: true });
    const res = await fetchPendingReviews();

    if (res.status === 200 && res.data) {
      set({ reviews: res.data.reviews, loading: false });
    } else {
      set({ reviews: [], loading: false });
    }
  },

  loadDetail: async (applicationId: string) => {
    const requestId = ++loadDetailSeq;
    set({
      detailLoading: true,
      notesLoading: true,
      detail: null,
      notes: [],
      localNotes: "",
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
    const { reviews, currentIndex } = get();
    if (currentIndex < reviews.length - 1) {
      const newIndex = currentIndex + 1;
      set({ currentIndex: newIndex });
      get().loadDetail(reviews[newIndex].application_id);
    }
  },

  navigatePrev: () => {
    const { reviews, currentIndex } = get();
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      set({ currentIndex: newIndex });
      get().loadDetail(reviews[newIndex].application_id);
    }
  },

  submitVote: async (reviewId: string, vote: ReviewVote) => {
    set({ submitting: true });

    const { localNotes } = get();
    const result = await submitReviewVote(reviewId, {
      vote,
      notes: localNotes || undefined,
    });

    if (result.success) {
      const { reviews, currentIndex } = get();
      const filtered = reviews.filter((r) => r.id !== reviewId);
      const newIndex = Math.min(currentIndex, filtered.length - 1);

      set({
        reviews: filtered,
        currentIndex: Math.max(0, newIndex),
        submitting: false,
        localNotes: "",
      });

      toast.success(`Vote submitted: ${vote}`);

      if (filtered.length > 0) {
        get().loadDetail(filtered[Math.max(0, newIndex)].application_id);
      } else {
        set({ detail: null, notes: [] });
      }
    } else {
      set({ submitting: false });
      toast.error(result.error ?? "Failed to submit vote");
    }
  },

  setLocalNotes: (notes: string) => {
    set({ localNotes: notes });
  },

  reset: () => {
    loadDetailSeq = 0;
    set(initialState);
  },
}));
