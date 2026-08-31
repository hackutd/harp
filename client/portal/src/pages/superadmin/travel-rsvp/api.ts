import { getRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse, ApplicationSchemaField } from "@/types";

interface TravelRSVPSchemaResponse {
  fields: ApplicationSchemaField[];
}

interface TravelRSVPEnabledResponse {
  enabled: boolean;
}

export async function fetchTravelRSVPSchema(
  signal?: AbortSignal,
): Promise<ApiResponse<TravelRSVPSchemaResponse>> {
  return getRequest<TravelRSVPSchemaResponse>(
    "/superadmin/settings/travel-rsvp-schema",
    "travel RSVP schema",
    signal,
  );
}

export async function saveTravelRSVPSchema(
  fields: ApplicationSchemaField[],
): Promise<ApiResponse<TravelRSVPSchemaResponse>> {
  return putRequest<TravelRSVPSchemaResponse>(
    "/superadmin/settings/travel-rsvp-schema",
    { fields },
    "travel RSVP schema",
  );
}

export async function fetchTravelRSVPEnabled(
  signal?: AbortSignal,
): Promise<ApiResponse<TravelRSVPEnabledResponse>> {
  return getRequest<TravelRSVPEnabledResponse>(
    "/superadmin/settings/travel-rsvp-enabled",
    "travel RSVP enabled",
    signal,
  );
}

export async function saveTravelRSVPEnabled(
  enabled: boolean,
): Promise<ApiResponse<TravelRSVPEnabledResponse>> {
  return putRequest<TravelRSVPEnabledResponse>(
    "/superadmin/settings/travel-rsvp-enabled",
    { enabled },
    "travel RSVP enabled",
  );
}
