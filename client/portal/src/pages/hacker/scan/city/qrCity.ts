import qrcode from "qrcode-generator";

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
  row: number;
  col: number;
  /** Footprint in modules; merged blocks cover several dark modules. */
  w: number;
  h: number;
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
/** Adjacent dark modules of the same kind merge into blocks up to this size. */
export const MAX_FOOTPRINT = 3;

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

export function buildCityLayout(value: string): CityLayout {
  const modules = buildQrModules(value);
  const moduleCount = modules.length;
  const rng = createRng(hashSeed(value));
  const cells: CityCell[] = [];
  const taken = modules.map((row) => row.map(() => false));

  const free = (row: number, col: number, kind: CellKind) =>
    row < moduleCount &&
    col < moduleCount &&
    modules[row][col] &&
    !taken[row][col] &&
    (finderKind(row, col, moduleCount) ?? "building") === kind;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!modules[row][col] || taken[row][col]) continue;
      const kind = finderKind(row, col, moduleCount) ?? "building";

      let w = 1;
      while (w < MAX_FOOTPRINT && free(row, col + w, kind)) w++;
      let h = 1;
      while (h < MAX_FOOTPRINT) {
        let rowFree = true;
        for (let c = col; c < col + w; c++) {
          if (!free(row + h, c, kind)) rowFree = false;
        }
        if (!rowFree) break;
        h++;
      }
      for (let r = row; r < row + h; r++) {
        for (let c = col; c < col + w; c++) taken[r][c] = true;
      }

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
        row,
        col,
        w,
        h,
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
