// Application Review feature API layer

import { getRequest } from "@/shared/lib/api";
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
  const res = await fetch(`/admin/reviews/${reviewId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    return { success: true };
  } else {
    const data = await res.json().catch(() => ({}));
    return { success: false, error: data.error || 'Failed to submit vote' };
  }
}

/**
 * Fetch notes from other reviewers for an application
 */
export async function fetchReviewNotes(
  applicationId: string
): Promise<ApiResponse<NotesListResponse>> {
  return getRequest<NotesListResponse>(
    `/admin/reviews/applications/${applicationId}/notes`,
    "review notes"
  );
}
