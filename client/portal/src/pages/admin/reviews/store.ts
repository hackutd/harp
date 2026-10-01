// Unified Reviews store with tab state

import { toast } from "sonner";
import { create } from "zustand";

import {
  claimMoreReviews,
  fetchCompletedReviews,
  fetchPendingReviews,
  fetchReviewLeaderboard,
  submitReviewVote,
} from "./api";
import type { Review, ReviewerStats, SubmitVotePayload } from "./types";

export type ReviewTab = "assigned" | "completed" | "leaderboard";

export interface ReviewsState {
  tab: ReviewTab;
  reviews: Review[];
  leaderboard: ReviewerStats[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  claiming: boolean;
  setTab: (tab: ReviewTab) => void;
  fetchReviews: (signal?: AbortSignal) => Promise<void>;
  submitVote: (
    reviewId: string,
    payload: SubmitVotePayload,
  ) => Promise<{ success: boolean; error?: string }>;
  updateVote: (
    reviewId: string,
    payload: SubmitVotePayload,
  ) => Promise<{ success: boolean; error?: string }>;
  claimMore: () => Promise<void>;
}

let fetchSequence = 0;

export const useReviewsStore = create<ReviewsState>((set, get) => ({
  tab: "assigned",
  reviews: [],
  leaderboard: [],
  loading: false,
  error: null,
  submitting: false,
  claiming: false,

  setTab: (tab: ReviewTab) => {
    ++fetchSequence;
    set({ tab, reviews: [], error: null, loading: false });
  },

  fetchReviews: async (signal?: AbortSignal) => {
    const requestId = ++fetchSequence;
    set({ loading: true, reviews: [], error: null });

    const { tab } = get();
    if (tab === "leaderboard") {
      const res = await fetchReviewLeaderboard(signal);

      if (requestId !== fetchSequence) return;
      if (signal?.aborted) {
        set({ loading: false });
        return;
      }

      if (res.status === 200 && res.data) {
        set({ leaderboard: res.data.reviewers, loading: false, error: null });
      } else {
        set({
          leaderboard: [],
          loading: false,
          error:
            res.error || "Unable to load the leaderboard. Please try again.",
        });
      }
      return;
    }

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

  updateVote: async (reviewId: string, payload: SubmitVotePayload) => {
    set({ submitting: true });

    const result = await submitReviewVote(reviewId, payload);

    if (result.success && result.review) {
      // The review stays in the completed list; merge the returned row so
      // the badge, notes, and reviewed_at reflect the new decision.
      const updated = result.review;
      set((state) => ({
        reviews: state.reviews.map((r) =>
          r.id === reviewId ? { ...r, ...updated } : r,
        ),
        submitting: false,
      }));
    } else {
      set({ submitting: false });
    }

    return { success: result.success, error: result.error };
  },

  claimMore: async () => {
    if (get().claiming || get().tab !== "assigned") return;
    set({ claiming: true });

    const result = await claimMoreReviews();

    set({ claiming: false });
    if (!result.success) {
      toast.error(result.error ?? "Failed to get more reviews");
      return;
    }

    // Only replace the list if the admin is still looking at it. Bumping the
    // sequence keeps an in-flight fetch from overwriting the new queue.
    if (get().tab === "assigned") {
      ++fetchSequence;
      set({ reviews: result.reviews, loading: false, error: null });
    }
    if (result.claimed === 0) {
      toast.info("No reviews are available to pick up right now");
    } else {
      toast.success(
        `Picked up ${result.claimed} review${result.claimed === 1 ? "" : "s"}`,
      );
    }
  },
}));
