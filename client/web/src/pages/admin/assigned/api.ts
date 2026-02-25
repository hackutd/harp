// Application Review feature API layer

import { getRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { NotesListResponse, PendingReviewsResponse, SubmitVotePayload } from "./types";

/**
 * Fetch pending reviews assigned to the current admin
 */
export async function fetchPendingReviews(signal?: AbortSignal): Promise<ApiResponse<PendingReviewsResponse>> {
  return getRequest<PendingReviewsResponse>("/admin/reviews/pending", "pending reviews", signal);
}

/**
 * Submit a vote for a review
 */
export async function submitReviewVote(
  reviewId: string,
  payload: SubmitVotePayload
): Promise<{ success: boolean; error?: string }> {
  const res = await putRequest(`/admin/reviews/${reviewId}`, payload, "vote");

  if (res.status === 200) {
    return { success: true };
  } else {
    return { success: false, error: res.error || 'Failed to submit vote' };
  }
}

/**
 * Fetch notes from other reviewers for an application
 */
export async function fetchReviewNotes(
  applicationId: string
): Promise<ApiResponse<NotesListResponse>> {
  return getRequest<NotesListResponse>(
    `/admin/applications/${applicationId}/notes`,
    "review notes"
  );
}

export async function setAIPercent(
  applicationId: string,
  payload: { ai_percent: number }
): Promise<{ success: boolean; error?: string }> {
  const res = await putRequest(`/admin/applications/${applicationId}/ai-percent`, payload);

  if (res.status === 200) return { success: true };

  if (res.status === 404) {
    return { success: false, error: "Only the assigned admin can change this review's AI percent" };
  }
  if (res.status === 400) {
    if (payload.ai_percent > 100) {
      return { success: false, error: 'Percent cannot exceed 100%' };
    }
    if (payload.ai_percent < 0) {
      return { success: false, error: 'Percent cannot be below 0%' };
    }
  }
  return { success: false, error: res.error ?? 'Failed to set AI percent' };

}
