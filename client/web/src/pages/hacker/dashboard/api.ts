import { getRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

// Hackathon identity and key dates, configured by super admins. Kickoff is the
// hackathon start date rather than a separately configured date.
export interface HackathonConfig {
  hackathon_name: string;
  contact_email: string;
  application_due_date: string;
  start_date: string | null;
  end_date: string | null;
}

export async function fetchHackathonConfig(
  signal?: AbortSignal,
): Promise<ApiResponse<HackathonConfig>> {
  return getRequest<HackathonConfig>(
    "/hackathon-config",
    "hackathon config",
    signal,
  );
}
