import type { ApplicationStatus } from "@/pages/admin/all-applicants/types";
import { getRequest, postRequest } from "@/shared/lib/api";
import type { RSVPStatus } from "@/types";

import type {
  CreateDecisionReleasePayload,
  CreateDecisionReleaseResponse,
  DecisionEmailStatsResponse,
  DecisionReleaseAudience,
  DecisionReleasePreviewResponse,
  DecisionReleasesResponse,
  SendDecisionEmailsPayload,
  SendDecisionEmailsResponse,
} from "./types";

interface ApplicantEmail {
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface EmailListResponse {
  applicants: ApplicantEmail[];
  count: number;
}

/** rsvpStatus narrows the list by RSVP state; the server requires status "accepted" with it. */
export async function fetchApplicantEmails(
  status: ApplicationStatus,
  rsvpStatus?: RSVPStatus,
) {
  const query = new URLSearchParams({ status });
  if (rsvpStatus) query.set("rsvp_status", rsvpStatus);
  return getRequest<EmailListResponse>(
    `/superadmin/applications/emails?${query}`,
    "applicant emails",
  );
}

export async function fetchDecisionEmailStats(signal?: AbortSignal) {
  return getRequest<DecisionEmailStatsResponse>(
    "/superadmin/emails/decisions/stats",
    "decision email stats",
    signal,
  );
}

export async function sendDecisionEmails(payload: SendDecisionEmailsPayload) {
  return postRequest<SendDecisionEmailsResponse>(
    "/superadmin/emails/decisions",
    payload,
    "send decision emails",
  );
}

export async function fetchDecisionReleases(signal?: AbortSignal) {
  return getRequest<DecisionReleasesResponse>(
    "/superadmin/decisions/releases",
    "decision releases",
    signal,
  );
}

export async function previewDecisionRelease(
  audience: DecisionReleaseAudience,
  signal?: AbortSignal,
) {
  return getRequest<DecisionReleasePreviewResponse>(
    `/superadmin/decisions/releases/preview?${new URLSearchParams({ audience })}`,
    "decision release preview",
    signal,
  );
}

export async function createDecisionRelease(
  payload: CreateDecisionReleasePayload,
) {
  return postRequest<CreateDecisionReleaseResponse>(
    "/superadmin/decisions/releases",
    payload,
    "release decisions",
  );
}

export async function undoDecisionRelease(id: string) {
  return postRequest<DecisionReleasesResponse>(
    `/superadmin/decisions/releases/${encodeURIComponent(id)}/undo`,
    {},
    "undo decision release",
  );
}

// Additive response from POST /superadmin/applications/assign.
export interface BatchAssignmentResult {
  reviews_created: number;
  reviews_removed: number;
  reviews_per_application: number;
  applications_below_target: number;
  reviews_unfilled: number;
}
