// Application Review feature store

import { create } from "zustand";

import { fetchPendingReviews, submitReviewVote } from "./api";
import type { Review, SubmitVotePayload } from "./types";

export interface ReviewsState {
  reviews: Review[];
  loading: boolean;
  submitting: boolean;
  fetchPendingReviews: (signal?: AbortSignal) => Promise<void>;
  submitVote: (reviewId: string, payload: SubmitVotePayload) => Promise<{ success: boolean; error?: string }>;
}

export const useReviewsStore = create<ReviewsState>((set) => ({
  reviews: [],
  loading: false,
  submitting: false,

  fetchPendingReviews: async (signal?: AbortSignal) => {
    set({ loading: true });

    const res = await fetchPendingReviews(signal);

    if (signal?.aborted) return;

    if (res.status === 200 && res.data) {
      set({ reviews: res.data.reviews, loading: false });
    } else {
      set({ reviews: [], loading: false });
    }
  },

  submitVote: async (reviewId: string, payload: SubmitVotePayload) => {
    set({ submitting: true });

    const result = await submitReviewVote(reviewId, payload);

    if (result.success) {
      // Remove the review from the list (it's no longer pending)
      set((state) => ({
        reviews: state.reviews.filter((r) => r.id !== reviewId),
        submitting: false,
      }));
    } else {
      set({ submitting: false });
    }

    return result;
  },
}));
