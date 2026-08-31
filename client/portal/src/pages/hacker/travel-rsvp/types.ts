import type { ApplicationSchemaField, RSVPStatus } from "@/types";

export interface TravelRSVPInfo {
  travel_rsvp_status: RSVPStatus;
  travel_rsvp_responses: Record<string, unknown>;
  travel_rsvp_submitted_at: string | null;
  travel_receipt_paths: string[] | null;
  travel_rsvp_schema: ApplicationSchemaField[];
  travel_rsvp_enabled: boolean;
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
