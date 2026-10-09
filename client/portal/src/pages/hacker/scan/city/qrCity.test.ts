import { describe, expect, it } from "vitest";

import {
  buildCityLayout,
  buildQrModules,
  CRANE_MIN_HEIGHT,
  createRng,
  FACADE_COLORS,
  finderKind,
  hashSeed,
  HEIGHT_STEP,
  MAX_REGION,
  modulesToSvgPath,
  QUIET_ZONE,
} from "./qrCity";

const USER_ID = "3f2d9c6e-8a1b-4c7d-9e0f-123456789abc";

describe("buildQrModules", () => {
  it("encodes a UUID as a 29x29 (version 3) code", () => {
    const modules = buildQrModules(USER_ID);
    expect(modules).toHaveLength(29);
    expect(modules.every((row) => row.length === 29)).toBe(true);
  });

  it("has the three finder patterns in the corners", () => {
    const modules = buildQrModules(USER_ID);
    const n = modules.length;
    for (const [r0, c0] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ]) {
      expect(modules[r0][c0]).toBe(true);
      expect(modules[r0 + 1][c0 + 1]).toBe(false);
      expect(modules[r0 + 3][c0 + 3]).toBe(true);
    }
  });
});

describe("hashSeed / createRng", () => {
  it("is deterministic and seed-sensitive", () => {
    expect(hashSeed(USER_ID)).toBe(hashSeed(USER_ID));
    expect(hashSeed(USER_ID)).not.toBe(hashSeed(USER_ID + "x"));

    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const first = a();
    expect(first).toBe(b());
    expect(first).not.toBe(c());
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
  });
});

describe("finderKind", () => {
  it.each([
    [0, 0, "finder-ring"],
    [3, 3, "finder-core"],
    [2, 4, "finder-core"],
    [1, 1, "finder-ring"],
    [0, 22, "finder-ring"],
    [3, 25, "finder-core"],
    [25, 3, "finder-core"],
    [22, 22, null],
    [10, 10, null],
    [7, 7, null],
  ] as const)("row %i col %i -> %s", (row, col, expected) => {
    expect(finderKind(row, col, 29)).toBe(expected);
  });
});

describe("buildCityLayout", () => {
  it("places exactly one building on every dark module", () => {
    const layout = buildCityLayout(USER_ID);
    const dark = layout.modules.flat().filter(Boolean).length;
    expect(layout.plateSize).toBe(layout.moduleCount + QUIET_ZONE * 2);
    const covered = new Set<string>();
    for (const cell of layout.cells) {
      expect(cell.modules.length).toBeGreaterThanOrEqual(1);
      if (cell.kind === "building") {
        expect(cell.modules.length).toBeLessThanOrEqual(MAX_REGION);
      }
      for (const [r, c] of cell.modules) {
        expect(r).toBeGreaterThanOrEqual(cell.row);
        expect(r).toBeLessThan(cell.row + cell.h);
        expect(c).toBeGreaterThanOrEqual(cell.col);
        expect(c).toBeLessThan(cell.col + cell.w);
        expect(layout.modules[r][c]).toBe(true);
        expect(covered.has(`${r},${c}`)).toBe(false);
        covered.add(`${r},${c}`);
      }
    }
    expect(covered.size).toBe(dark);
    expect(layout.cells.length).toBeLessThan(dark / 4);
  });

  it("tints facades and only puts cranes on tall plain blocks", () => {
    const layout = buildCityLayout(USER_ID);
    for (const cell of layout.cells) {
      expect(cell.tint).toBeGreaterThanOrEqual(0);
      expect(cell.tint).toBeLessThan(FACADE_COLORS.length);
      if (cell.crane) {
        expect(cell.kind).toBe("building");
        expect(cell.billboard).toBe(false);
        expect(cell.height).toBeGreaterThanOrEqual(CRANE_MIN_HEIGHT);
      }
      if (cell.billboard) expect(cell.kind).toBe("building");
    }
    expect(new Set(layout.cells.map((c) => c.tint)).size).toBeGreaterThan(1);
    expect(layout.cells.some((c) => c.billboard)).toBe(true);
    expect(layout.cells.some((c) => c.crane)).toBe(true);
  });

  it("snaps heights to the window texture step", () => {
    const layout = buildCityLayout(USER_ID);
    for (const cell of layout.cells) {
      expect(cell.height).toBeGreaterThan(0);
      expect((cell.height / HEIGHT_STEP) % 1).toBe(0);
    }
  });

  it("makes the finder cores the tallest landmarks", () => {
    const layout = buildCityLayout(USER_ID);
    const cores = layout.cells.filter((c) => c.kind === "finder-core");
    const rest = layout.cells.filter((c) => c.kind !== "finder-core");
    expect(cores).toHaveLength(3);
    expect(cores.every((c) => c.w === 3 && c.h === 3)).toBe(true);
    expect(cores.every((c) => c.modules.length === 9)).toBe(true);
    const rings = layout.cells.filter((c) => c.kind === "finder-ring");
    expect(rings).toHaveLength(3);
    expect(rings.every((c) => c.modules.length === 24)).toBe(true);
    const coreHeight = cores[0].height;
    expect(cores.every((c) => c.height === coreHeight)).toBe(true);
    expect(Math.max(...rest.map((c) => c.height))).toBeLessThan(coreHeight);
  });

  it("gives the same hacker the same skyline and different hackers different ones", () => {
    const a = buildCityLayout(USER_ID);
    const b = buildCityLayout(USER_ID);
    const other = buildCityLayout("9e0f1234-5678-4abc-8def-3f2d9c6e8a1b");
    expect(a.cells).toEqual(b.cells);
    const heights = (layout: typeof a) =>
      layout.cells.map((c) => `${c.row},${c.col}:${c.height}`).join("|");
    expect(heights(a)).not.toBe(heights(other));
  });
});

describe("modulesToSvgPath", () => {
  it("merges horizontal runs and offsets by the quiet zone", () => {
    const modules = [
      [true, true, false],
      [false, true, false],
      [false, false, false],
    ];
    expect(modulesToSvgPath(modules, 4)).toBe("M4 4h2v1h-2zM5 5h1v1h-1z");
  });

  it("returns an empty path for an all-light matrix", () => {
    expect(modulesToSvgPath([[false]], 0)).toBe("");
  });
});
