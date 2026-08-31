import { getRequest, patchRequest } from "@/shared/lib/api";
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
): Promise<ApiResponse<{ application: Application }>> {
  return patchRequest<{ application: Application }>(
    `/superadmin/applications/${id}/travel-status`,
    { travel_status: travelStatus },
    "travel status",
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
