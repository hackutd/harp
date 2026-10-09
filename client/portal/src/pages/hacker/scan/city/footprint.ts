export type Point = [x: number, y: number];
export type Module = [row: number, col: number];

export interface Outline {
  /** Counter-clockwise ring in (col, row) module space. */
  outer: Point[];
  holes: Point[][];
}

type Edge = { from: Point; to: Point };

const key = (p: Point) => `${p[0]},${p[1]}`;

/**
 * Traces the boundary of a set of grid modules into simple polygons, each
 * inset by `gap / 2` so neighbouring footprints keep a visible seam. Loops
 * that only touch at a corner stay separate; enclosed light modules become
 * holes. Points are (col, row).
 */
export function footprintOutline(modules: Module[], gap = 0): Outline[] {
  const edges = boundaryEdges(modules);
  const loops = chainLoops(edges).map((loop) =>
    insetRectilinear(dropCollinear(loop), gap / 2),
  );
  const outers: Outline[] = [];
  const holes: Point[][] = [];
  for (const loop of loops) {
    if (signedArea(loop) > 0) outers.push({ outer: loop, holes: [] });
    else holes.push(loop);
  }
  for (const hole of holes) {
    const owner =
      outers.find((o) => pointInPolygon(hole[0], o.outer)) ?? outers[0];
    owner?.holes.push(hole);
  }
  return outers;
}

/** Each module contributes a counter-clockwise unit square; shared edges cancel. */
function boundaryEdges(modules: Module[]): Edge[] {
  const filled = new Set(modules.map(([r, c]) => `${r},${c}`));
  const edges: Edge[] = [];
  for (const [r, c] of modules) {
    if (!filled.has(`${r - 1},${c}`)) {
      edges.push({ from: [c, r], to: [c + 1, r] });
    }
    if (!filled.has(`${r},${c + 1}`)) {
      edges.push({ from: [c + 1, r], to: [c + 1, r + 1] });
    }
    if (!filled.has(`${r + 1},${c}`)) {
      edges.push({ from: [c + 1, r + 1], to: [c, r + 1] });
    }
    if (!filled.has(`${r},${c - 1}`)) {
      edges.push({ from: [c, r + 1], to: [c, r] });
    }
  }
  return edges;
}

/**
 * Follows edges head to tail. Where two loops meet at a corner there are two
 * ways out; taking the sharpest left turn keeps every loop simple.
 */
function chainLoops(edges: Edge[]): Point[][] {
  const outgoing = new Map<string, Edge[]>();
  for (const edge of edges) {
    const k = key(edge.from);
    const list = outgoing.get(k);
    if (list) list.push(edge);
    else outgoing.set(k, [edge]);
  }
  const used = new Set<Edge>();
  const loops: Point[][] = [];

  for (const start of edges) {
    if (used.has(start)) continue;
    const loop: Point[] = [];
    let edge = start;
    while (!used.has(edge)) {
      used.add(edge);
      loop.push(edge.from);
      const candidates = (outgoing.get(key(edge.to)) ?? []).filter(
        (e) => !used.has(e),
      );
      if (candidates.length === 0) break;
      const dx = edge.to[0] - edge.from[0];
      const dy = edge.to[1] - edge.from[1];
      edge = candidates.reduce((best, e) => {
        const turn = (e: Edge) =>
          dx * (e.to[1] - e.from[1]) - dy * (e.to[0] - e.from[0]);
        return turn(e) > turn(best) ? e : best;
      });
    }
    loops.push(loop);
  }
  return loops;
}

function dropCollinear(loop: Point[]): Point[] {
  const out: Point[] = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const prev = loop[(i + n - 1) % n];
    const cur = loop[i];
    const next = loop[(i + 1) % n];
    const cross =
      (cur[0] - prev[0]) * (next[1] - cur[1]) -
      (cur[1] - prev[1]) * (next[0] - cur[0]);
    if (cross !== 0) out.push(cur);
  }
  return out;
}

/** Interior is on the left of every edge, so inset along each edge's left normal. */
function insetRectilinear(loop: Point[], amount: number): Point[] {
  if (amount === 0) return loop;
  const n = loop.length;
  return loop.map((cur, i) => {
    const prev = loop[(i + n - 1) % n];
    const next = loop[(i + 1) % n];
    const inDir = normalize([cur[0] - prev[0], cur[1] - prev[1]]);
    const outDir = normalize([next[0] - cur[0], next[1] - cur[1]]);
    const nx = -inDir[1] - outDir[1];
    const ny = inDir[0] + outDir[0];
    return [cur[0] + nx * amount, cur[1] + ny * amount];
  });
}

function normalize([x, y]: Point): Point {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}

export function signedArea(loop: Point[]): number {
  let area = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x1, y1] = loop[i];
    const [x2, y2] = loop[(i + 1) % loop.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function pointInPolygon([px, py]: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}
