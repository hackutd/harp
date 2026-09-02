import type { ApplicationSchemaField, RSVPStatus } from "@/types";

export interface RSVPInfo {
  rsvp_status: RSVPStatus;
  rsvp_responses: Record<string, unknown>;
  rsvp_submitted_at: string | null;
  rsvp_schema: ApplicationSchemaField[];
  rsvp_enabled: boolean;
}

export interface SubmitRSVPPayload {
  status: Exclude<RSVPStatus, "pending">;
  responses?: Record<string, unknown>;
}
