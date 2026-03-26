import type { ApplicationStatus } from "@/pages/admin/all-applicants/types";
import { getRequest } from "@/shared/lib/api";

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
