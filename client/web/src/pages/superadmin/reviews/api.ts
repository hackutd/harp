import type { ApplicationStatus } from "@/pages/admin/all-applicants/types";
import { getRequest, postRequest } from "@/shared/lib/api";

import type {
  DecisionEmailStatsResponse,
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

export async function fetchApplicantEmails(status: ApplicationStatus) {
  return getRequest<EmailListResponse>(
    `/superadmin/applications/emails?status=${status}`,
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
