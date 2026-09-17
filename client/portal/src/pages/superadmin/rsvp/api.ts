import { getRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse, ApplicationSchemaField } from "@/types";

interface RSVPSchemaResponse {
  fields: ApplicationSchemaField[];
}

interface RSVPEnabledResponse {
  enabled: boolean;
}

export async function fetchRSVPSchema(
  signal?: AbortSignal,
): Promise<ApiResponse<RSVPSchemaResponse>> {
  return getRequest<RSVPSchemaResponse>(
    "/superadmin/settings/rsvp-schema",
    "RSVP schema",
    signal,
  );
}

export async function saveRSVPSchema(
  fields: ApplicationSchemaField[],
): Promise<ApiResponse<RSVPSchemaResponse>> {
  return putRequest<RSVPSchemaResponse>(
    "/superadmin/settings/rsvp-schema",
    { fields },
    "RSVP schema",
  );
}

export async function fetchRSVPEnabled(
  signal?: AbortSignal,
): Promise<ApiResponse<RSVPEnabledResponse>> {
  return getRequest<RSVPEnabledResponse>(
    "/superadmin/settings/rsvp-enabled",
    "RSVP enabled",
    signal,
  );
}

export async function saveRSVPEnabled(
  enabled: boolean,
): Promise<ApiResponse<RSVPEnabledResponse>> {
  return putRequest<RSVPEnabledResponse>(
    "/superadmin/settings/rsvp-enabled",
    { enabled },
    "RSVP enabled",
  );
}
