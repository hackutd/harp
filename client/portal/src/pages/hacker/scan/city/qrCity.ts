import qrcode from "qrcode-generator";

import type { Module } from "./footprint";

/** Plain modules of padding around the code, as the QR spec requires. */
export const QUIET_ZONE = 4;
export const FINDER_SIZE = 7;

/** Light plate + plaza tiles: the QR's light modules seen from above. */
export const PLATE_COLOR = "#ece9f3";
export const PLAZA_COLORS = ["#f5f3f9", "#e4e1ee"] as const;
/** Rooftops: the QR's dark modules seen from above. */
export const ROOF_COLOR = "#0b0c15";
export const NEON = { magenta: "#ff2ee6", cyan: "#22e0ff", violet: "#7828ff" };
/** Facade tints; a block picks one by `tint`. Roofs stay ROOF_COLOR. */
export const FACADE_COLORS = [
  "#161829",
  "#241a4d",
  "#0f2d3a",
  "#3a1232",
  "#1c2447",
  "#2b1f3f",
  "#10343a",
  "#202a50",
] as const;

export type CellKind = "finder-ring" | "finder-core" | "building";
export type WindowPalette = 0 | 1;

export interface CityCell {
  /** Bounding box of the footprint, in modules. */
  row: number;
  col: number;
  w: number;
  h: number;
  /** The dark modules this building stands on (4-connected, same kind). */
  modules: Module[];
  kind: CellKind;
  height: number;
  palette: WindowPalette;
  /** Index into FACADE_COLORS. */
  tint: number;
  /** Rooftop props; they shrink away as the camera goes top-down. */
  billboard: boolean;
  crane: boolean;
}

export interface CityLayout {
  value: string;
  moduleCount: number;
  plateSize: number;
  modules: boolean[][];
  cells: CityCell[];
}

/** Heights snap to this step so one window texture fits every building. */
export const HEIGHT_STEP = 0.5;
const MIN_HEIGHT = 3;
const MAX_HEIGHT = 9;
const TOWER_HEIGHT = 13;
const FINDER_RING_HEIGHT = 4;
const FINDER_CORE_HEIGHT = 15;
const TOWER_CHANCE = 0.1;
const BILLBOARD_CHANCE = 0.14;
const CRANE_CHANCE = 0.3;
/** Only blocks at least this tall get a crane. */
export const CRANE_MIN_HEIGHT = 8;
/** Connected dark modules grow into one building of up to this many modules. */
export const MIN_REGION = 8;
export const MAX_REGION = 20;

export function buildQrModules(value: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(value, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const modules: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    modules.push(row);
  }
  return modules;
}

/** FNV-1a: cheap, stable hash so the same hacker always gets the same city. */
export function hashSeed(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: tiny seeded PRNG returning [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finderOrigin(
  row: number,
  col: number,
  moduleCount: number,
): [number, number] | null {
  const far = moduleCount - FINDER_SIZE;
  if (row < FINDER_SIZE && col < FINDER_SIZE) return [0, 0];
  if (row < FINDER_SIZE && col >= far) return [0, far];
  if (row >= far && col < FINDER_SIZE) return [far, 0];
  return null;
}

export function finderKind(
  row: number,
  col: number,
  moduleCount: number,
): Exclude<CellKind, "building"> | null {
  const origin = finderOrigin(row, col, moduleCount);
  if (!origin) return null;
  const r = row - origin[0];
  const c = col - origin[1];
  const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
  return isCore ? "finder-core" : "finder-ring";
}

function snap(height: number): number {
  return Math.round(height / HEIGHT_STEP) * HEIGHT_STEP;
}

/**
 * Flood-fills from a seed through free modules of the same kind, always
 * taking the frontier module that keeps the bounding box smallest so the
 * footprint stays blob-shaped rather than snaking across the code.
 */
function growRegion(
  row: number,
  col: number,
  kind: CellKind,
  limit: number,
  free: (row: number, col: number, kind: CellKind) => boolean,
): Module[] {
  const region: Module[] = [[row, col]];
  const inRegion = new Set([`${row},${col}`]);
  let top = row;
  let bottom = row;
  let left = col;
  let right = col;

  while (region.length < limit) {
    let best: Module | null = null;
    let bestArea = Infinity;
    for (const [r, c] of region) {
      const neighbours: Module[] = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ];
      for (const [nr, nc] of neighbours) {
        if (nr < 0 || nc < 0 || inRegion.has(`${nr},${nc}`)) continue;
        if (!free(nr, nc, kind)) continue;
        const area =
          (Math.max(bottom, nr) - Math.min(top, nr) + 1) *
          (Math.max(right, nc) - Math.min(left, nc) + 1);
        if (area < bestArea) {
          bestArea = area;
          best = [nr, nc];
        }
      }
    }
    if (!best) break;
    region.push(best);
    inRegion.add(`${best[0]},${best[1]}`);
    top = Math.min(top, best[0]);
    bottom = Math.max(bottom, best[0]);
    left = Math.min(left, best[1]);
    right = Math.max(right, best[1]);
  }
  return region;
}

export function buildCityLayout(value: string): CityLayout {
  const modules = buildQrModules(value);
  const moduleCount = modules.length;
  const rng = createRng(hashSeed(value));
  const cells: CityCell[] = [];
  const taken = modules.map((row) => row.map(() => false));

  const free = (row: number, col: number, kind: CellKind) =>
    row >= 0 &&
    col >= 0 &&
    row < moduleCount &&
    col < moduleCount &&
    modules[row][col] &&
    !taken[row][col] &&
    (finderKind(row, col, moduleCount) ?? "building") === kind;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!modules[row][col] || taken[row][col]) continue;
      const kind = finderKind(row, col, moduleCount) ?? "building";
      const limit =
        kind === "building"
          ? MIN_REGION + Math.floor(rng() * (MAX_REGION - MIN_REGION + 1))
          : Infinity;
      const region = growRegion(row, col, kind, limit, free);
      for (const [r, c] of region) taken[r][c] = true;
      const rows = region.map(([r]) => r);
      const cols = region.map(([, c]) => c);
      const top = Math.min(...rows);
      const left = Math.min(...cols);
      const w = Math.max(...cols) - left + 1;
      const h = Math.max(...rows) - top + 1;

      const palette: WindowPalette = rng() < 0.5 ? 0 : 1;
      const tint = Math.floor(rng() * FACADE_COLORS.length);
      let height: number;
      if (kind === "finder-core") {
        height = FINDER_CORE_HEIGHT;
      } else if (kind === "finder-ring") {
        height = FINDER_RING_HEIGHT;
      } else if (rng() < TOWER_CHANCE) {
        height = TOWER_HEIGHT;
      } else {
        height = snap(MIN_HEIGHT + rng() * (MAX_HEIGHT - MIN_HEIGHT));
      }
      const isBuilding = kind === "building";
      const billboard = isBuilding && rng() < BILLBOARD_CHANCE;
      const crane =
        isBuilding &&
        !billboard &&
        height >= CRANE_MIN_HEIGHT &&
        rng() < CRANE_CHANCE;
      cells.push({
        row: top,
        col: left,
        w,
        h,
        modules: region,
        kind,
        height,
        palette,
        tint,
        billboard,
        crane,
      });
    }
  }

  return {
    value,
    moduleCount,
    plateSize: moduleCount + QUIET_ZONE * 2,
    modules,
    cells,
  };
}

/**
 * One SVG path covering every dark module, in plate coordinates (the quiet
 * zone is the offset), so the vector QR lines up with the rooftops below it.
 */
export function modulesToSvgPath(modules: boolean[][], offset: number): string {
  const parts: string[] = [];
  for (let r = 0; r < modules.length; r++) {
    let c = 0;
    while (c < modules[r].length) {
      if (!modules[r][c]) {
        c++;
        continue;
      }
      let run = 1;
      while (c + run < modules[r].length && modules[r][c + run]) run++;
      parts.push(`M${c + offset} ${r + offset}h${run}v1h-${run}z`);
      c += run;
    }
  }
  return parts.join("");
}
