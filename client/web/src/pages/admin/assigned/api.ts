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

export async function setAIpercent(
  applicationId: string,
  payload: { ai_percent: number }
): Promise<{ success: boolean; error?: string }> {
  const res = await putRequest(`/admin/applications/${applicationId}/ai-percent`, payload);

  if (res.status === 200) {
    return { success: true };
  } else {
    if (res.error === "not found") {
      return {success: false, error: "You do not have permission to change this review's percent, only the assigned admin can"}
    }
    else{
      return { success: false, error: res.error || 'Failed to set AI percent' };
    }
  }

}
