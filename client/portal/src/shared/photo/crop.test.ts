import { describe, expect, it } from "vitest";

import {
  CENTERED_CROP,
  clampCrop,
  cropImageStyle,
  cropRect,
  MAX_PHOTO_ZOOM,
  outputSize,
  panCrop,
  visibleFraction,
} from "./crop";

const landscape = { width: 4000, height: 3000 };
const portrait = { width: 3000, height: 4000 };

describe("visibleFraction", () => {
  it("fills the frame's height with a landscape photo", () => {
    const { fw, fh } = visibleFraction(landscape, 1);
    expect(fh).toBe(1);
    // 4:5 frame over a 4:3 photo: 0.8 / (4/3) of the width.
    expect(fw).toBeCloseTo(0.6);
  });

  it("fills the frame's width with a tall photo", () => {
    const { fw, fh } = visibleFraction({ width: 1000, height: 2000 }, 1);
    expect(fw).toBe(1);
    expect(fh).toBeCloseTo(0.625);
  });

  it("shows less of the photo as it zooms in", () => {
    const { fw, fh } = visibleFraction(portrait, 2);
    expect(fw).toBeCloseTo(0.5);
    expect(fh).toBeCloseTo(0.5 * (0.75 / 0.8));
  });
});

describe("clampCrop", () => {
  it("keeps the frame on the photo", () => {
    const crop = clampCrop(landscape, { cx: 0, cy: 0.9, zoom: 1 });
    expect(crop.cx).toBeCloseTo(0.3);
    // The height already fills the frame, so there is no room to move.
    expect(crop.cy).toBe(0.5);
  });

  it("keeps the zoom in range", () => {
    expect(clampCrop(landscape, { ...CENTERED_CROP, zoom: 0.2 }).zoom).toBe(1);
    expect(clampCrop(landscape, { ...CENTERED_CROP, zoom: 99 }).zoom).toBe(
      MAX_PHOTO_ZOOM,
    );
  });
});

describe("panCrop", () => {
  it("dragging right shows more of the photo's left side", () => {
    const crop = panCrop(landscape, CENTERED_CROP, 50, 0, 400);
    expect(crop.cx).toBeLessThan(0.5);
    // 50px of a 400px frame showing 60% of the width.
    expect(crop.cx).toBeCloseTo(0.5 - 0.125 * 0.6);
  });

  it("stops at the photo's edge", () => {
    const crop = panCrop(landscape, CENTERED_CROP, 5000, 0, 400);
    expect(crop.cx).toBeCloseTo(0.3);
  });
});

describe("cropRect and cropImageStyle", () => {
  it("cuts the centred frame out of a landscape photo", () => {
    expect(cropRect(landscape, CENTERED_CROP)).toEqual({
      sx: expect.closeTo(800),
      sy: 0,
      sw: expect.closeTo(2400),
      sh: 3000,
    });
  });

  it("positions the image so the crop fills the frame", () => {
    const style = cropImageStyle(landscape, CENTERED_CROP);
    expect(parseFloat(style.width)).toBeCloseTo(100 / 0.6);
    expect(parseFloat(style.height)).toBeCloseTo(100);
    expect(parseFloat(style.left)).toBeCloseTo(-(0.2 / 0.6) * 100);
    expect(parseFloat(style.top)).toBeCloseTo(0);
  });
});

describe("outputSize", () => {
  it("scales a large crop down and keeps 4:5", () => {
    expect(outputSize(landscape, CENTERED_CROP)).toEqual({
      width: 1080,
      height: 1350,
    });
  });

  it("never scales a small crop up", () => {
    expect(outputSize({ width: 400, height: 500 }, CENTERED_CROP)).toEqual({
      width: 400,
      height: 500,
    });
  });
});
