import { MAX_PHOTO_SIZE_BYTES } from "./api";
import { cropRect, outputSize, type PhotoCrop } from "./crop";

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
}

/**
 * Draws the framed part of a photo into a JPEG ready to upload. Re-encoding
 * also turns HEIC and oversized camera photos into something the upload
 * accepts. Returns null when the browser can't export the image (a
 * cross-origin picture without CORS taints the canvas).
 */
export async function renderCroppedPhoto(
  image: HTMLImageElement,
  crop: PhotoCrop,
): Promise<File | null> {
  const natural = { width: image.naturalWidth, height: image.naturalHeight };
  const { sx, sy, sw, sh } = cropRect(natural, crop);
  const { width, height } = outputSize(natural, crop);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

  try {
    for (const quality of [0.9, 0.8, 0.65]) {
      const blob = await toBlob(canvas, quality);
      if (!blob) return null;
      if (blob.size <= MAX_PHOTO_SIZE_BYTES) {
        return new File([blob], "photo.jpg", { type: "image/jpeg" });
      }
    }
  } catch {
    return null;
  }
  return null;
}
