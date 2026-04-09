import { postRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type { ResetHackathonOptions, ResetHackathonResult } from "./types";

export async function resetHackathon(
  options: ResetHackathonOptions,
): Promise<ApiResponse<ResetHackathonResult>> {
  return postRequest<ResetHackathonResult>(
    "/superadmin/reset-hackathon",
    options,
  );
}
