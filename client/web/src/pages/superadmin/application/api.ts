import { getRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse, ApplicationSchemaField } from "@/types";

interface ApplicationSchemaResponse {
  fields: ApplicationSchemaField[];
}

export async function fetchApplicationSchema(
  signal?: AbortSignal,
): Promise<ApiResponse<ApplicationSchemaResponse>> {
  return getRequest<ApplicationSchemaResponse>(
    "/superadmin/settings/application-schema",
    "application schema",
    signal,
  );
}

export async function saveApplicationSchema(
  fields: ApplicationSchemaField[],
): Promise<ApiResponse<ApplicationSchemaResponse>> {
  return putRequest<ApplicationSchemaResponse>(
    "/superadmin/settings/application-schema",
    { fields },
    "application schema",
  );
}
