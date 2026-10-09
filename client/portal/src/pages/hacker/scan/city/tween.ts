export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * The vector QR fades in over the last stretch of the camera's descent, once
 * the rooftops already read as a flat code, so the swap is invisible.
 */
export const OVERLAY_FADE_START = 0.82;

export function overlayOpacity(progress: number): number {
  return clamp01((progress - OVERLAY_FADE_START) / (1 - OVERLAY_FADE_START));
}

export interface TweenOptions {
  from: number;
  to: number;
  durationMs: number;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}

/** Drives onUpdate from `from` to `to` on animation frames. Returns a cancel. */
export function startTween({
  from,
  to,
  durationMs,
  onUpdate,
  onComplete,
}: TweenOptions): () => void {
  if (durationMs <= 0 || from === to) {
    onUpdate(to);
    onComplete?.();
    return () => {};
  }

  let frame = 0;
  const startedAt = performance.now();
  const step = (now: number) => {
    const t = clamp01((now - startedAt) / durationMs);
    onUpdate(from + (to - from) * easeInOutCubic(t));
    if (t < 1) {
      frame = requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
