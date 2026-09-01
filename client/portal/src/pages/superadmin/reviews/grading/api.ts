import { getRequest, patchRequest, postRequest } from "@/shared/lib/api";
import type { ApiResponse, Application, ApplicationSchemaField } from "@/types";

export async function setApplicationStatus(
  id: string,
  status: "accepted" | "rejected" | "waitlisted",
): Promise<ApiResponse<{ application: Application }>> {
  return patchRequest<{ application: Application }>(
    `/superadmin/applications/${id}/status`,
    { status },
    "application status",
  );
}

export async function setApplicationTravelStatus(
  id: string,
  travelStatus: "approved" | "rejected" | "pending",
  approvedAmountCents?: number,
): Promise<ApiResponse<{ application: Application }>> {
  return patchRequest<{ application: Application }>(
    `/superadmin/applications/${id}/travel-status`,
    {
      travel_status: travelStatus,
      ...(approvedAmountCents !== undefined
        ? { approved_amount_cents: approvedAmountCents }
        : {}),
    },
    "travel status",
  );
}

/**
 * Clears a hacker's one-shot RSVP so they can claim or decline their spot
 * again. The travel RSVP goes with it — it only exists under a confirmed RSVP.
 */
export async function resetApplicationRSVP(
  id: string,
): Promise<ApiResponse<{ application: Application }>> {
  return postRequest<{ application: Application }>(
    `/superadmin/applications/${id}/rsvp/reset`,
    {},
    "RSVP reset",
  );
}

/**
 * Clears a hacker's submitted travel form and deletes their uploaded receipts.
 * Also the way to unpin the travel decision once the form has been submitted.
 */
export async function resetApplicationTravelRSVP(
  id: string,
): Promise<ApiResponse<{ application: Application }>> {
  return postRequest<{ application: Application }>(
    `/superadmin/applications/${id}/travel-rsvp/reset`,
    {},
    "travel form reset",
  );
}

export interface TravelReceiptURL {
  path: string;
  download_url: string;
}

export async function fetchTravelRSVPSchema(
  signal?: AbortSignal,
): Promise<ApiResponse<{ fields: ApplicationSchemaField[] }>> {
  return getRequest<{ fields: ApplicationSchemaField[] }>(
    "/superadmin/settings/travel-rsvp-schema",
    "travel RSVP schema",
    signal,
  );
}

export async function fetchTravelReceiptURLs(
  applicationId: string,
  signal?: AbortSignal,
): Promise<ApiResponse<{ receipts: TravelReceiptURL[] }>> {
  return getRequest<{ receipts: TravelReceiptURL[] }>(
    `/admin/applications/${applicationId}/travel-receipt-urls`,
    "travel receipts",
    signal,
  );
}
