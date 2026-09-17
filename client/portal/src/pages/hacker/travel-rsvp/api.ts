import { getRequest, postRequest } from "@/shared/lib/api";
import type { ApiResponse } from "@/types";

import type {
  ReceiptContentType,
  SubmitTravelRSVPPayload,
  TravelReceiptDownloadURLResponse,
  TravelReceiptUploadURLResponse,
  TravelRSVPInfo,
} from "./types";

// Signed URL upload limits must match the x-goog-content-length-range the
// backend signs into the URL (5MB for PDFs, 2MB for images).
export const MAX_RECEIPT_PDF_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_RECEIPT_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

export async function fetchMyTravelRSVP(
  signal?: AbortSignal,
): Promise<ApiResponse<TravelRSVPInfo>> {
  return getRequest<TravelRSVPInfo>(
    "/applications/me/travel-rsvp",
    "travel RSVP",
    signal,
  );
}

export async function submitMyTravelRSVP(
  payload: SubmitTravelRSVPPayload,
): Promise<ApiResponse<TravelRSVPInfo>> {
  return postRequest<TravelRSVPInfo>(
    "/applications/me/travel-rsvp",
    payload,
    "travel RSVP",
  );
}

export async function requestTravelReceiptUploadURL(
  contentType: ReceiptContentType,
): Promise<ApiResponse<TravelReceiptUploadURLResponse>> {
  return postRequest<TravelReceiptUploadURLResponse>(
    "/applications/me/travel-rsvp/receipt-upload-url",
    { content_type: contentType },
    "receipt upload url",
  );
}

export async function requestTravelReceiptDownloadURL(
  path: string,
): Promise<ApiResponse<TravelReceiptDownloadURLResponse>> {
  return getRequest<TravelReceiptDownloadURLResponse>(
    `/applications/me/travel-rsvp/receipt-url?path=${encodeURIComponent(path)}`,
    "receipt",
  );
}

export async function uploadReceiptToSignedURL(
  uploadURL: string,
  file: File,
  contentType: ReceiptContentType,
): Promise<{ status: number; error?: string }> {
  const maxBytes =
    contentType === "application/pdf"
      ? MAX_RECEIPT_PDF_SIZE_BYTES
      : MAX_RECEIPT_IMAGE_SIZE_BYTES;

  try {
    const response = await fetch(uploadURL, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-goog-content-length-range": `0,${maxBytes}`,
      },
      body: file,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      return {
        status: response.status,
        error:
          message || `Receipt upload failed with status ${response.status}`,
      };
    }

    return { status: response.status };
  } catch (error) {
    return {
      status: 500,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
