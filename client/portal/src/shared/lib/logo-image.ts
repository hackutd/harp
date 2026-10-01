/**
 * Client-side logo preparation: decode an uploaded image, downscale it so its
 * longest side is at most MAX_LOGO_DIMENSION, and re-encode it as WebP. This
 * keeps the base64 payload stored by HARP (and served to public consumers)
 * roughly an order of magnitude smaller than a raw upload.
 *
 * Transparency is preserved. Animated GIFs are flattened to their first frame.
 * If the browser cannot encode WebP, PNG is used instead; if re-encoding does
 * not actually shrink the file, the original bytes are kept.
 */

export const MAX_LOGO_DIMENSION = 512;
const WEBP_QUALITY = 0.85;

export interface PreparedLogo {
  base64: string;
  contentType: string;
  byteLength: number;
}

async function decodeImage(
  file: File,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path for formats createImageBitmap rejects.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function imageSize(source: ImageBitmap | HTMLImageElement): {
  width: number;
  height: number;
} {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function prepareLogoForUpload(file: File): Promise<PreparedLogo> {
  const source = await decodeImage(file);
  const { width, height } = imageSize(source);
  if (width === 0 || height === 0) {
    throw new Error("Could not decode image");
  }

  const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this browser");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();

  let encoded = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  if (!encoded || encoded.type !== "image/webp") {
    encoded = await canvasToBlob(canvas, "image/png");
  }

  const best =
    encoded && (encoded.size < file.size || scale < 1) ? encoded : file;

  return {
    base64: await blobToBase64(best),
    contentType: best.type,
    byteLength: best.size,
  };
}
