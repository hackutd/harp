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
  error: string | null;
  currentIndex: number;
  detail: Application | null;
  detailLoading: boolean;
  notes: ReviewNote[];
  notesLoading: boolean;
  submitting: boolean;
  localNotes: string;
  localTravelVote: boolean | null;
  fetchReviews: (
    targetReviewId?: string,
    signal?: AbortSignal,
  ) => Promise<void>;
  loadDetail: (applicationId: string) => Promise<void>;
  navigateNext: () => void;
  navigatePrev: () => void;
  submitVote: (reviewId: string, vote: ReviewVote) => Promise<void>;
  setLocalNotes: (notes: string) => void;
  setLocalTravelVote: (vote: boolean) => void;
  reset: () => void;
}

const initialState = {
  reviews: [] as Review[],
  loading: false,
  error: null as string | null,
  currentIndex: 0,
  detail: null as Application | null,
  detailLoading: false,
  notes: [] as ReviewNote[],
  notesLoading: false,
  submitting: false,
  localNotes: "",
  localTravelVote: null as boolean | null,
};

let loadDetailSeq = 0;
let fetchSequence = 0;

export const useAdminGradingStore = create<GradingState>((set, get) => ({
  ...initialState,

  fetchReviews: async (targetReviewId, signal) => {
    const requestId = ++fetchSequence;
    ++loadDetailSeq;
    set({ ...initialState, loading: true });
    const res = await fetchPendingReviews(signal);

    if (requestId !== fetchSequence) return;
    if (signal?.aborted) {
      set({ loading: false });
      return;
    }
    if (res.status === 200 && res.data) {
      const reviews = res.data.reviews;
      const targetIndex = reviews.findIndex((r) => r.id === targetReviewId);
      const currentIndex = Math.max(0, targetIndex);
      set({ reviews, currentIndex, loading: false, error: null });
      if (reviews.length > 0) {
        await get().loadDetail(reviews[currentIndex].application_id);
      }
    } else {
      set({
        loading: false,
        error: res.error || "Unable to load reviews. Please try again.",
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
      localNotes: "",
      localTravelVote: null,
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
    const { reviews, currentIndex, loading, error, submitting } = get();
    if (loading || error || submitting) return;
    if (currentIndex < reviews.length - 1) {
      const newIndex = currentIndex + 1;
      set({ currentIndex: newIndex });
      get().loadDetail(reviews[newIndex].application_id);
    }
  },

  navigatePrev: () => {
    const { reviews, currentIndex, loading, error, submitting } = get();
    if (loading || error || submitting) return;
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      set({ currentIndex: newIndex });
      get().loadDetail(reviews[newIndex].application_id);
    }
  },

  submitVote: async (reviewId: string, vote: ReviewVote) => {
    if (get().loading || get().error || get().submitting) return;
    const queueVersion = fetchSequence;
    set({ submitting: true });

    const { localNotes, localTravelVote, reviews: allReviews } = get();
    const review = allReviews.find((r) => r.id === reviewId);
    const travelRequested =
      !!review && review.travel_status !== "not_requested";
    const result = await submitReviewVote(reviewId, {
      vote,
      travel_vote:
        travelRequested && localTravelVote !== null
          ? localTravelVote
          : undefined,
      notes: localNotes || undefined,
    });

    if (queueVersion !== fetchSequence) return;
    if (result.success) {
      const { reviews, currentIndex } = get();
      const filtered = reviews.filter((r) => r.id !== reviewId);
      const newIndex = Math.min(currentIndex, filtered.length - 1);

      set({
        reviews: filtered,
        currentIndex: Math.max(0, newIndex),
        submitting: false,
        localNotes: "",
        localTravelVote: null,
      });

      toast.success(`Vote submitted: ${vote}`);

      if (filtered.length > 0) {
        get().loadDetail(filtered[Math.max(0, newIndex)].application_id);
      } else {
        ++loadDetailSeq;
        set({
          detail: null,
          notes: [],
          detailLoading: false,
          notesLoading: false,
        });
      }
    } else {
      set({ submitting: false });
      toast.error(result.error ?? "Failed to submit vote");
    }
  },

  setLocalNotes: (notes: string) => {
    set({ localNotes: notes });
  },

  setLocalTravelVote: (vote: boolean) => {
    set({ localTravelVote: vote });
  },

  reset: () => {
    ++loadDetailSeq;
    ++fetchSequence;
    set(initialState);
  },
}));
