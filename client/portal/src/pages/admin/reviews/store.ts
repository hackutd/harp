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
  error: string | null;
  submitting: boolean;
  setTab: (tab: ReviewTab) => void;
  fetchReviews: (signal?: AbortSignal) => Promise<void>;
  submitVote: (
    reviewId: string,
    payload: SubmitVotePayload,
  ) => Promise<{ success: boolean; error?: string }>;
}

let fetchSequence = 0;

export const useReviewsStore = create<ReviewsState>((set, get) => ({
  tab: "assigned",
  reviews: [],
  loading: false,
  error: null,
  submitting: false,

  setTab: (tab: ReviewTab) => {
    ++fetchSequence;
    set({ tab, reviews: [], error: null, loading: false });
  },

  fetchReviews: async (signal?: AbortSignal) => {
    const requestId = ++fetchSequence;
    set({ loading: true, reviews: [], error: null });

    const { tab } = get();
    const res =
      tab === "assigned"
        ? await fetchPendingReviews(signal)
        : await fetchCompletedReviews(signal);

    if (requestId !== fetchSequence) return;
    if (signal?.aborted) {
      set({ loading: false });
      return;
    }

    if (res.status === 200 && res.data) {
      set({ reviews: res.data.reviews, loading: false, error: null });
    } else {
      set({
        reviews: [],
        loading: false,
        error: res.error || "Unable to load reviews. Please try again.",
      });
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
