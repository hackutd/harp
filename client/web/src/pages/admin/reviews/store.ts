// Unified Reviews store with tab state

import { create } from "zustand";

import {
  fetchCompletedReviews,
  fetchPendingReviews,
  submitReviewVote,
} from "./api";
import type { Review, SubmitVotePayload } from "./types";

export type ReviewTab = "assigned" | "completed";

export interface ReviewsState {
  tab: ReviewTab;
  reviews: Review[];
  loading: boolean;
  submitting: boolean;
  setTab: (tab: ReviewTab) => void;
  fetchReviews: (signal?: AbortSignal) => Promise<void>;
  submitVote: (
    reviewId: string,
    payload: SubmitVotePayload,
  ) => Promise<{ success: boolean; error?: string }>;
}

export const useReviewsStore = create<ReviewsState>((set, get) => ({
  tab: "assigned",
  reviews: [],
  loading: false,
  submitting: false,

  setTab: (tab: ReviewTab) => {
    set({ tab, reviews: [] });
  },

  fetchReviews: async (signal?: AbortSignal) => {
    set({ loading: true });

    const { tab } = get();
    const res =
      tab === "assigned"
        ? await fetchPendingReviews(signal)
        : await fetchCompletedReviews(signal);

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
