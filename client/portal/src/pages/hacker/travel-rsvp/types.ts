import type { ApplicationSchemaField, RSVPStatus } from "@/types";

export interface TravelRSVPInfo {
  travel_rsvp_status: RSVPStatus;
  travel_rsvp_responses: Record<string, unknown>;
  travel_rsvp_submitted_at: string | null;
  travel_receipt_paths: string[] | null;
  travel_rsvp_schema: ApplicationSchemaField[];
  travel_rsvp_enabled: boolean;
  /**
   * The reimbursement amount the organizers committed to. Decided by a super
   * admin and never editable by the hacker.
   */
  travel_approved_amount_cents: number | null;
  /**
   * The answer that makes a receipt upload mandatory, reported by the backend
   * so the rule is not duplicated here — super admins can rename the field or
   * its options in the travel RSVP schema editor.
   */
  receipt_required_field_id: string;
  receipt_required_value: string;
}

export interface SubmitTravelRSVPPayload {
  status: Exclude<RSVPStatus, "pending">;
  responses?: Record<string, unknown>;
  receipt_paths?: string[];
}

export type ReceiptContentType = "application/pdf" | "image/png" | "image/jpeg";

export interface TravelReceiptUploadURLResponse {
  upload_url: string;
  receipt_path: string;
}

export interface TravelReceiptDownloadURLResponse {
  download_url: string;
}

export interface UploadedReceipt {
  path: string;
  name: string;
}
