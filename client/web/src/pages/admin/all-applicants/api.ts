import { getRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse, Application } from "@/types";

import type {
  ApplicationListResult,
  ApplicationStats,
  ApplicationStatus,
  FetchParams,
} from "./types";

interface ResumeDownloadURLResponse {
  download_url: string;
}

/**
 * Fetch paginated applications with optional status filter
 */
export async function fetchApplications(
  params?: FetchParams,
  signal?: AbortSignal,
): Promise<ApiResponse<ApplicationListResult>> {
  const queryParams = new URLSearchParams();

  if (params?.status) {
    queryParams.set("status", params.status);
  }

  if (params?.cursor) {
    queryParams.set("cursor", params.cursor);
  }

  if (params?.direction) {
    queryParams.set("direction", params.direction);
  }

  if (params?.search) {
    queryParams.set("search", params.search);
  }

  if (params?.sort_by) {
    queryParams.set("sort_by", params.sort_by);
  }

  const queryString = queryParams.toString();
  const endpoint = `/admin/applications${queryString ? `?${queryString}` : ""}`;

  return getRequest<ApplicationListResult>(endpoint, "applications", signal);
}

/**
 * Fetch application statistics
 */
export async function fetchApplicationStats(
  signal?: AbortSignal,
): Promise<ApiResponse<ApplicationStats>> {
  return getRequest<ApplicationStats>(
    "/admin/applications/stats",
    "stats",
    signal,
  );
}

/**
 * Fetch a single application by ID
 */
export async function fetchApplicationById(
  id: string,
): Promise<ApiResponse<Application>> {
  return getRequest<Application>(`/admin/applications/${id}`, "application");
}

/**
 * Fetch a signed resume URL for admin viewing
 */
export async function fetchApplicationResumeURL(
  id: string,
): Promise<ApiResponse<ResumeDownloadURLResponse>> {
  return getRequest<ResumeDownloadURLResponse>(
    `/admin/applications/${id}/resume-url`,
    "resume",
  );
}

/**
 * Update application status
 */
export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<ApiResponse<Application>> {
  return putRequest<Application>(
    `/admin/applications/${id}`,
    { status },
    "application status",
  );
}
