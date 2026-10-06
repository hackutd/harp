import { fetchApplications } from "@/pages/admin/all-applicants/api";
import type { FetchParams } from "@/pages/admin/all-applicants/types";
import { getRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { FormKey, FormsOverviewData, FormsResponsePage } from "./types";

export async function fetchFormsOverview(
  signal?: AbortSignal,
): Promise<ApiResponse<FormsOverviewData>> {
  return getRequest<FormsOverviewData>(
    "/superadmin/forms/summary",
    "forms overview",
    signal,
  );
}

export async function setFormEnabled(
  form: FormKey,
  enabled: boolean,
): Promise<ApiResponse<{ enabled: boolean }>> {
  const endpoint =
    form === "application"
      ? "/superadmin/settings/applications-enabled"
      : form === "rsvp"
        ? "/superadmin/settings/rsvp-enabled"
        : "/superadmin/settings/travel-rsvp-enabled";

  return putRequest<{ enabled: boolean }>(
    endpoint,
    { enabled },
    `${form} availability`,
  );
}

const TRAVEL_REQUESTS_ENDPOINT =
  "/superadmin/settings/travel-applications-enabled";

export async function fetchTravelRequestsEnabled(
  signal?: AbortSignal,
): Promise<ApiResponse<{ enabled: boolean }>> {
  return getRequest<{ enabled: boolean }>(
    TRAVEL_REQUESTS_ENDPOINT,
    "travel applications enabled",
    signal,
  );
}

export async function setTravelRequestsEnabled(
  enabled: boolean,
): Promise<ApiResponse<{ enabled: boolean }>> {
  return putRequest<{ enabled: boolean }>(
    TRAVEL_REQUESTS_ENDPOINT,
    { enabled },
    "travel applications enabled",
  );
}

export async function fetchFormResponses(
  form: FormKey,
  params: FetchParams,
  signal?: AbortSignal,
): Promise<ApiResponse<FormsResponsePage>> {
  const formFilters: FetchParams =
    form === "application"
      ? {}
      : form === "rsvp"
        ? { status: "accepted" }
        : { travel_requested: true };

  return fetchApplications({ ...formFilters, ...params }, signal);
}
