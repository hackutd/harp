import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clamp01,
  easeInOutCubic,
  OVERLAY_FADE_START,
  overlayOpacity,
  prefersReducedMotion,
  startTween,
} from "./tween";

describe("easeInOutCubic", () => {
  it.each([
    [0, 0],
    [0.5, 0.5],
    [1, 1],
  ])("maps %f to %f", (input, expected) => {
    expect(easeInOutCubic(input)).toBeCloseTo(expected);
  });

  it("is slow at both ends", () => {
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });
});

describe("clamp01 / overlayOpacity", () => {
  it.each([
    [-1, 0],
    [0.5, 0.5],
    [2, 1],
  ])("clamp01(%f) = %f", (input, expected) => {
    expect(clamp01(input)).toBe(expected);
  });

  it("keeps the vector QR hidden until the camera is nearly overhead", () => {
    expect(overlayOpacity(0)).toBe(0);
    expect(overlayOpacity(OVERLAY_FADE_START)).toBe(0);
    expect(overlayOpacity((OVERLAY_FADE_START + 1) / 2)).toBeCloseTo(0.5);
    expect(overlayOpacity(1)).toBe(1);
  });
});

describe("startTween", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("jumps straight to the target when the duration is zero", () => {
    const onUpdate = vi.fn();
    const onComplete = vi.fn();
    startTween({ from: 0, to: 1, durationMs: 0, onUpdate, onComplete });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("eases from start to end over animation frames", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const onUpdate = vi.fn();
    const onComplete = vi.fn();
    startTween({ from: 0, to: 1, durationMs: 100, onUpdate, onComplete });

    now = 1050;
    frames.shift()?.(now);
    expect(onUpdate).toHaveBeenLastCalledWith(0.5);
    expect(onComplete).not.toHaveBeenCalled();

    now = 1200;
    frames.shift()?.(now);
    expect(onUpdate).toHaveBeenLastCalledWith(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(0);
  });

  it("cancels the pending frame", () => {
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", () => 7);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const stop = startTween({
      from: 0,
      to: 1,
      durationMs: 100,
      onUpdate: vi.fn(),
    });
    stop();
    expect(cancel).toHaveBeenCalledWith(7);
  });
});

describe("prefersReducedMotion", () => {
  it("is false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("reflects the media query", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(prefersReducedMotion()).toBe(true);
  });
});
