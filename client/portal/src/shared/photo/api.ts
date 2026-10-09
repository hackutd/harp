import { deleteRequest, postRequest, putRequest } from "@/shared/lib/api";
import type { ApiResponse, User } from "@/types";

export type PhotoContentType = "image/jpeg" | "image/png" | "image/webp";

export const PHOTO_CONTENT_TYPES: PhotoContentType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// Must match the x-goog-content-length-range the backend signs for images.
export const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

export function requestPhotoUploadURL(
  contentType: PhotoContentType,
): Promise<ApiResponse<{ upload_url: string; photo_path: string }>> {
  return postRequest(
    "/users/me/photo-upload-url",
    { content_type: contentType },
    "photo upload URL",
  );
}

// The upload goes straight to object storage with a signed URL, so it can't
// use the API client.
export async function uploadPhotoToSignedURL(
  uploadURL: string,
  file: File,
): Promise<{ status: number; error?: string }> {
  try {
    const response = await fetch(uploadURL, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        "x-goog-content-length-range": `0,${MAX_PHOTO_SIZE_BYTES}`,
      },
      body: file,
    });
    if (!response.ok) {
      return {
        status: response.status,
        error: `Photo upload failed with status ${response.status}`,
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

export function setMyPhoto(photoPath: string): Promise<ApiResponse<User>> {
  return putRequest<User>(
    "/users/me/photo",
    { photo_path: photoPath },
    "profile photo",
  );
}

export function removeMyPhoto(): Promise<ApiResponse<User>> {
  return deleteRequest<User>("/users/me/photo", "profile photo");
}
