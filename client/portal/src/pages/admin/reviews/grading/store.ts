import { toast } from "sonner";
import { create } from "zustand";

import { fetchApplicationById } from "@/pages/admin/all-applicants/api";
import type { Application } from "@/types";

import {
  claimMoreReviews,
  fetchCompletedReviews,
  fetchPendingReviews,
  fetchReviewNotes,
  submitReviewVote,
} from "../api";
import type { Review, ReviewNote, ReviewVote } from "../types";

/** "pending" grades the admin's queue; "completed" changes votes already cast. */
export type GradingMode = "pending" | "completed";

interface GradingState {
  mode: GradingMode;
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
  /** Draft vote while changing a completed review. */
  localVote: ReviewVote | null;
  claiming: boolean;
  fetchReviews: (
    targetReviewId?: string,
    signal?: AbortSignal,
    mode?: GradingMode,
  ) => Promise<void>;
  loadDetail: (applicationId: string) => Promise<void>;
  navigateNext: () => void;
  navigatePrev: () => void;
  submitVote: (reviewId: string, vote: ReviewVote) => Promise<void>;
  updateVote: (reviewId: string) => Promise<void>;
  discardChanges: () => void;
  claimMore: () => Promise<void>;
  setLocalNotes: (notes: string) => void;
  setLocalTravelVote: (vote: boolean) => void;
  setLocalVote: (vote: ReviewVote) => void;
  reset: () => void;
}

const initialState = {
  mode: "pending" as GradingMode,
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
  localVote: null as ReviewVote | null,
  claiming: false,
};

let loadDetailSeq = 0;
let fetchSequence = 0;

/** Drafts start from the saved review in completed mode and empty otherwise. */
function draftsFor(mode: GradingMode, review: Review | undefined) {
  if (mode === "completed" && review) {
    return {
      localNotes: review.notes ?? "",
      localTravelVote: review.travel_vote,
      localVote: review.vote,
    };
  }
  return { localNotes: "", localTravelVote: null, localVote: null };
}

/** True when a completed review's drafts differ from what was saved. */
export function hasUnsavedChanges(
  state: Pick<
    GradingState,
    | "mode"
    | "reviews"
    | "currentIndex"
    | "localNotes"
    | "localTravelVote"
    | "localVote"
  >,
): boolean {
  const review = state.reviews[state.currentIndex];
  if (state.mode !== "completed" || !review) return false;
  const travelRequested = review.travel_status !== "not_requested";
  return (
    state.localVote !== review.vote ||
    (travelRequested && state.localTravelVote !== review.travel_vote) ||
    state.localNotes !== (review.notes ?? "")
  );
}

export const useAdminGradingStore = create<GradingState>((set, get) => ({
  ...initialState,

  fetchReviews: async (targetReviewId, signal, mode = "pending") => {
    const requestId = ++fetchSequence;
    ++loadDetailSeq;
    set({ ...initialState, mode, loading: true });
    const res =
      mode === "completed"
        ? await fetchCompletedReviews(signal)
        : await fetchPendingReviews(signal);

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
    const { mode, reviews, currentIndex } = get();
    set({
      detailLoading: true,
      notesLoading: true,
      detail: null,
      notes: [],
      ...draftsFor(mode, reviews[currentIndex]),
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
    if (loading || error || submitting || hasUnsavedChanges(get())) return;
    if (currentIndex < reviews.length - 1) {
      const newIndex = currentIndex + 1;
      set({ currentIndex: newIndex });
      get().loadDetail(reviews[newIndex].application_id);
    }
  },

  navigatePrev: () => {
    const { reviews, currentIndex, loading, error, submitting } = get();
    if (loading || error || submitting || hasUnsavedChanges(get())) return;
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
    // A 404 means the review is no longer this admin's: another reviewer
    // picked it up. Drop it from the queue the same way and move on.
    const reassigned = !result.success && result.status === 404;
    if (result.success || reassigned) {
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

      if (reassigned) {
        toast.info("This review is no longer assigned to you. Moving on.");
      } else {
        toast.success(`Vote submitted: ${vote}`);
      }

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

  updateVote: async (reviewId: string) => {
    const { loading, error, submitting, localVote } = get();
    if (loading || error || submitting || !localVote) return;
    const queueVersion = fetchSequence;
    set({ submitting: true });

    const { localNotes, localTravelVote, reviews } = get();
    const review = reviews.find((r) => r.id === reviewId);
    const travelRequested =
      !!review && review.travel_status !== "not_requested";
    const result = await submitReviewVote(reviewId, {
      vote: localVote,
      travel_vote:
        travelRequested && localTravelVote !== null
          ? localTravelVote
          : undefined,
      notes: localNotes || undefined,
    });

    if (queueVersion !== fetchSequence) return;
    if (result.success && result.review) {
      // The review stays in the completed list; merge the returned row so
      // the badge, notes, and reviewed_at reflect the new decision.
      const updated = result.review;
      set((state) => ({
        reviews: state.reviews.map((r) =>
          r.id === reviewId ? { ...r, ...updated } : r,
        ),
        submitting: false,
        localNotes: updated.notes ?? "",
        localTravelVote: updated.travel_vote,
        localVote: updated.vote,
      }));
      toast.success(`Vote updated: ${localVote}`);
    } else {
      set({ submitting: false });
      toast.error(result.error ?? "Failed to update vote");
    }
  },

  discardChanges: () => {
    const { mode, reviews, currentIndex } = get();
    set(draftsFor(mode, reviews[currentIndex]));
  },

  claimMore: async () => {
    const { loading, submitting, claiming } = get();
    if (loading || submitting || claiming) return;
    const requestId = ++fetchSequence;
    ++loadDetailSeq;
    set({ claiming: true });

    const result = await claimMoreReviews();

    // The page was reset or refetched while this was in flight.
    if (requestId !== fetchSequence) return;
    set({ claiming: false });
    if (!result.success) {
      toast.error(result.error ?? "Failed to get more reviews");
      return;
    }

    const reviews = result.reviews;
    set({ reviews, currentIndex: 0, localNotes: "", localTravelVote: null });
    if (result.claimed === 0) {
      toast.info("No reviews are available to pick up right now");
    } else {
      toast.success(
        `Picked up ${result.claimed} review${result.claimed === 1 ? "" : "s"}`,
      );
    }
    if (reviews.length > 0) {
      await get().loadDetail(reviews[0].application_id);
    }
  },

  setLocalNotes: (notes: string) => {
    set({ localNotes: notes });
  },

  setLocalTravelVote: (vote: boolean) => {
    set({ localTravelVote: vote });
  },

  setLocalVote: (vote: ReviewVote) => {
    set({ localVote: vote });
  },

  reset: () => {
    ++loadDetailSeq;
    ++fetchSequence;
    set(initialState);
  },
}));
