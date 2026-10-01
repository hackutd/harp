// Application Review feature API layer

import { getRequest, postRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type {
  ClaimReviewsResponse,
  NotesListResponse,
  Review,
  ReviewLeaderboardResponse,
  ReviewRecord,
  ReviewResponse,
  ReviewsListResponse,
  SubmitVotePayload,
} from "./types";

/**
 * Fetch pending reviews assigned to the current admin
 */
export async function fetchPendingReviews(
  signal?: AbortSignal,
): Promise<ApiResponse<ReviewsListResponse>> {
  return getRequest<ReviewsListResponse>(
    "/admin/reviews/pending",
    "pending reviews",
    signal,
  );
}

/**
 * Fetch completed reviews for the current admin
 */
export async function fetchCompletedReviews(
  signal?: AbortSignal,
): Promise<ApiResponse<ReviewsListResponse>> {
  return getRequest<ReviewsListResponse>(
    "/admin/reviews/completed",
    "completed reviews",
    signal,
  );
}

/**
 * Fetch every admin ranked by completed reviews
 */
export async function fetchReviewLeaderboard(
  signal?: AbortSignal,
): Promise<ApiResponse<ReviewLeaderboardResponse>> {
  return getRequest<ReviewLeaderboardResponse>(
    "/admin/reviews/leaderboard",
    "review leaderboard",
    signal,
  );
}

/**
 * Submit a vote for a review. Calling this on an already-voted review
 * replaces the vote, travel vote, and notes. A 404 means the review is no
 * longer assigned to this admin (another reviewer picked it up).
 */
export async function submitReviewVote(
  reviewId: string,
  payload: SubmitVotePayload,
): Promise<{
  success: boolean;
  status: number;
  review?: ReviewRecord;
  error?: string;
}> {
  const res = await putRequest<ReviewResponse>(
    `/admin/reviews/${reviewId}`,
    payload,
    "vote",
  );

  if (res.status === 200) {
    return { success: true, status: res.status, review: res.data?.review };
  } else {
    return {
      success: false,
      status: res.status,
      error: res.error || "Failed to submit vote",
    };
  }
}

/**
 * Claim up to five more reviews once the admin's own queue is empty. On
 * success, `reviews` is the admin's new pending queue.
 */
export async function claimMoreReviews(): Promise<{
  success: boolean;
  claimed: number;
  reviews: Review[];
  error?: string;
}> {
  const res = await postRequest<ClaimReviewsResponse>(
    "/admin/reviews/claim",
    {},
    "more reviews",
  );

  if (res.status === 200 && res.data) {
    return {
      success: true,
      claimed: res.data.claimed,
      reviews: res.data.reviews,
    };
  }

  const failure = { success: false, claimed: 0, reviews: [] };
  if (res.status === 409) {
    return {
      ...failure,
      error: "Finish your assigned reviews before picking up more",
    };
  }
  if (res.status === 403) {
    return {
      ...failure,
      error: "Review assignment is turned off for your account",
    };
  }
  return { ...failure, error: res.error ?? "Failed to get more reviews" };
}

/**
 * Fetch notes from other reviewers for an application
 */
export async function fetchReviewNotes(
  applicationId: string,
): Promise<ApiResponse<NotesListResponse>> {
  return getRequest<NotesListResponse>(
    `/admin/applications/${applicationId}/notes`,
    "review notes",
  );
}

export async function setAIPercent(
  applicationId: string,
  payload: { ai_percent: number },
): Promise<{ success: boolean; error?: string }> {
  const res = await putRequest(
    `/admin/applications/${applicationId}/ai-percent`,
    payload,
  );

  if (res.status === 200) return { success: true };

  if (res.status === 404) {
    return {
      success: false,
      error: "Only the assigned admin can change this review's AI percent",
    };
  }
  if (res.status === 400) {
    if (payload.ai_percent > 100) {
      return { success: false, error: "Percent cannot exceed 100%" };
    }
    if (payload.ai_percent < 0) {
      return { success: false, error: "Percent cannot be below 0%" };
    }
  }
  return { success: false, error: res.error ?? "Failed to set AI percent" };
}
