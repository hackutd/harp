import { getRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { LegalConfig } from "./types";

/**
 * Fetches the operator's policy links. Unauthenticated — the login page needs
 * these before anyone has a session. Either field may be an empty string,
 * meaning the operator has not published that document.
 */
export async function fetchLegalConfig(
  signal?: AbortSignal,
): Promise<ApiResponse<LegalConfig>> {
  return getRequest<LegalConfig>("/legal", "legal links", signal);
}
