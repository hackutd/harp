import { getRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

/**
 * A field the backend itself reads out of an editable schema — the travel
 * opt-in checkbox, the travel mode answer that requires a receipt. Renaming or
 * deleting one silently switches the feature behind it off, so the editor
 * flags them and the backend refuses edits that leave them unusable.
 */
export interface SchemaFieldContract {
  field_id: string;
  required_type: string;
  required_options?: string[];
  /** The feature that depends on this field, shown on the field's badge. */
  purpose: string;
  /** What stops working if the field is removed entirely. */
  inactive_warning: string;
}

export interface SchemaContractResponse {
  application_schema: SchemaFieldContract[];
  travel_rsvp_schema: SchemaFieldContract[];
}

/** Which schema's bindings an editor should load. */
export type SchemaContractKey = keyof SchemaContractResponse;

export async function fetchSchemaContract(
  signal?: AbortSignal,
): Promise<ApiResponse<SchemaContractResponse>> {
  return getRequest<SchemaContractResponse>(
    "/superadmin/settings/schema-contract",
    "schema field contracts",
    signal,
  );
}
