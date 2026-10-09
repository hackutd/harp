// Framing a profile photo. The photo is stored already cropped to a 4:5
// card frame; round avatars show its centre square, so one crop serves both.

/** Width over height of the stored photo. */
export const CARD_PHOTO_ASPECT = 4 / 5;

export const MAX_PHOTO_ZOOM = 4;

/** Longest edge of the image we upload, in pixels. */
const OUTPUT_HEIGHT = 1350;

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Where the frame sits on the image: its centre as a fraction of the image's
 * width and height, and how far it is zoomed in (1 = the frame just covers
 * the image).
 */
export interface PhotoCrop {
  cx: number;
  cy: number;
  zoom: number;
}

export const CENTERED_CROP: PhotoCrop = { cx: 0.5, cy: 0.5, zoom: 1 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The fraction of the image's width and height the frame shows. */
export function visibleFraction(
  image: ImageSize,
  zoom: number,
  aspect = CARD_PHOTO_ASPECT,
): { fw: number; fh: number } {
  const imageAspect = image.width / image.height;
  if (imageAspect > aspect) {
    // Wider than the frame: the height fills it, the sides are cut.
    return { fw: aspect / imageAspect / zoom, fh: 1 / zoom };
  }
  return { fw: 1 / zoom, fh: imageAspect / aspect / zoom };
}

/** Keeps the zoom in range and the frame entirely on the image. */
export function clampCrop(
  image: ImageSize,
  crop: PhotoCrop,
  aspect = CARD_PHOTO_ASPECT,
): PhotoCrop {
  const zoom = clamp(crop.zoom, 1, MAX_PHOTO_ZOOM);
  const { fw, fh } = visibleFraction(image, zoom, aspect);
  return {
    cx: clamp(crop.cx, fw / 2, 1 - fw / 2),
    cy: clamp(crop.cy, fh / 2, 1 - fh / 2),
    zoom,
  };
}

/**
 * Moves the frame by a drag of (dx, dy) screen pixels over a frame
 * frameWidth pixels wide. Dragging right reveals more of the left.
 */
export function panCrop(
  image: ImageSize,
  crop: PhotoCrop,
  dx: number,
  dy: number,
  frameWidth: number,
  aspect = CARD_PHOTO_ASPECT,
): PhotoCrop {
  const { fw, fh } = visibleFraction(image, crop.zoom, aspect);
  const frameHeight = frameWidth / aspect;
  return clampCrop(
    image,
    {
      ...crop,
      cx: crop.cx - (dx / frameWidth) * fw,
      cy: crop.cy - (dy / frameHeight) * fh,
    },
    aspect,
  );
}

/**
 * CSS for an absolutely positioned <img> inside the frame, in percentages so
 * the same crop draws at any size (the editor and its small previews).
 */
export function cropImageStyle(
  image: ImageSize,
  crop: PhotoCrop,
  aspect = CARD_PHOTO_ASPECT,
): { width: string; height: string; left: string; top: string } {
  const { fw, fh } = visibleFraction(image, crop.zoom, aspect);
  return {
    width: `${100 / fw}%`,
    height: `${100 / fh}%`,
    left: `${(-(crop.cx - fw / 2) / fw) * 100}%`,
    top: `${(-(crop.cy - fh / 2) / fh) * 100}%`,
  };
}

/** The part of the image the frame shows, in image pixels. */
export function cropRect(
  image: ImageSize,
  crop: PhotoCrop,
  aspect = CARD_PHOTO_ASPECT,
): { sx: number; sy: number; sw: number; sh: number } {
  const { fw, fh } = visibleFraction(image, crop.zoom, aspect);
  return {
    sx: (crop.cx - fw / 2) * image.width,
    sy: (crop.cy - fh / 2) * image.height,
    sw: fw * image.width,
    sh: fh * image.height,
  };
}

/** The size of the uploaded image: the crop, scaled down to OUTPUT_HEIGHT. */
export function outputSize(
  image: ImageSize,
  crop: PhotoCrop,
  aspect = CARD_PHOTO_ASPECT,
): ImageSize {
  const { sh } = cropRect(image, crop, aspect);
  const height = Math.max(1, Math.round(Math.min(sh, OUTPUT_HEIGHT)));
  return { width: Math.max(1, Math.round(height * aspect)), height };
}
