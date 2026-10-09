import { describe, expect, it } from "vitest";

import { footprintOutline, type Module, signedArea } from "./footprint";

describe("footprintOutline", () => {
  it("traces a single module as one inset square", () => {
    const [outline] = footprintOutline([[2, 5]], 0.2);
    expect(footprintOutline([[2, 5]], 0.2)).toHaveLength(1);
    expect(outline.holes).toHaveLength(0);
    expect(outline.outer).toHaveLength(4);
    expect(signedArea(outline.outer)).toBeCloseTo(0.8 * 0.8);
    for (const [x, y] of outline.outer) {
      expect(x).toBeGreaterThanOrEqual(5.1);
      expect(x).toBeLessThanOrEqual(5.9);
      expect(y).toBeGreaterThanOrEqual(2.1);
      expect(y).toBeLessThanOrEqual(2.9);
    }
  });

  it("merges a straight run into a rectangle without seam vertices", () => {
    const run: Module[] = [
      [0, 0],
      [0, 1],
      [0, 2],
    ];
    const [outline] = footprintOutline(run);
    expect(outline.outer).toHaveLength(4);
    expect(signedArea(outline.outer)).toBeCloseTo(3);
  });

  it("keeps an L shape as one loop with six corners", () => {
    const l: Module[] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    const outlines = footprintOutline(l);
    expect(outlines).toHaveLength(1);
    expect(outlines[0].outer).toHaveLength(6);
    expect(signedArea(outlines[0].outer)).toBeCloseTo(3);
  });

  it("turns an enclosed light module into a hole", () => {
    const ring: Module[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (r !== 1 || c !== 1) ring.push([r, c]);
      }
    }
    const outlines = footprintOutline(ring);
    expect(outlines).toHaveLength(1);
    expect(signedArea(outlines[0].outer)).toBeCloseTo(9);
    expect(outlines[0].holes).toHaveLength(1);
    expect(signedArea(outlines[0].holes[0])).toBeCloseTo(-1);
  });

  it("splits modules that only touch at a corner into separate loops", () => {
    const outlines = footprintOutline([
      [0, 0],
      [1, 1],
    ]);
    expect(outlines).toHaveLength(2);
    for (const outline of outlines) {
      expect(outline.outer).toHaveLength(4);
      expect(signedArea(outline.outer)).toBeCloseTo(1);
    }
  });
});
