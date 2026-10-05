import { useEffect, useRef } from "react";

/**
 * ZeroDaySkyline: an isometric line drawing of a night city, in the manner of
 * Lucas Marques' hairline figures (lucasmarkes.com/lab/hairline), drawn in
 * one white stroke at four weights and answering the pointer.
 *
 * Towers rise under the pointer and fall off with distance; billboards and the
 * crane turn toward it; drones drift away from it; holding the pointer near
 * the monorail slows the train. Everything else is the rest pose. All motion
 * runs in one requestAnimationFrame loop that sleeps while the card is off
 * screen, the tab is hidden, or the reader asked for reduced motion.
 */

type Pt = [number, number];
type Sample = { u: number; v: number; nu: number; nv: number };
type Spring = { x: number; v: number; t: number; k: number; c: number };

// ---- camera: the 2:1 isometric view, azimuth 45° -------------------------
const AZ = Math.PI / 4;
const K = 0.5;
const ZF = Math.sqrt(1 - K * K);
const SC = Math.cos(AZ);
const SS = Math.sin(AZ);
const S = 1.9;
const OX = 0;
const OY = 0;

const P = (x: number, y: number, z: number): Pt => [
  OX + S * (x * SC - y * SS),
  OY + S * ((x * SS + y * SC) * K - z * ZF),
];
const unproj = (sx: number, sy: number, z: number): Pt => {
  const X = (sx - OX) / S;
  const Y = ((sy - OY) / S + z * ZF) / K;
  return [X * SC + Y * SS, -X * SS + Y * SC];
};
// A sample faces the camera when its normal points toward the viewer.
const front = (q: Sample) => q.nu * SS + q.nv * SC > 0;

// ---- rings and paths -----------------------------------------------------
const r2 = (n: number) => Math.round(n * 100) / 100;
const poly = (pts: Pt[]) =>
  "M" + pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join("L") + "Z";
const open = (pts: Pt[]) =>
  pts.length < 2
    ? ""
    : "M" + pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join("L");
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function rrect(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  r: number,
  n = 4,
): Sample[] {
  r = Math.max(0, Math.min(r, (u1 - u0) / 2, (v1 - v0) / 2));
  const out: Sample[] = [];
  const corners: [number, number, number][] = [
    [u1 - r, v1 - r, 0],
    [u0 + r, v1 - r, 90],
    [u0 + r, v0 + r, 180],
    [u1 - r, v0 + r, 270],
  ];
  for (const [cu, cv, a0] of corners)
    for (let k = 0; k <= n; k++) {
      const a = ((a0 + (90 * k) / n) * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      out.push({ u: cu + r * ca, v: cv + r * sa, nu: ca, nv: sa });
    }
  return out;
}
/** A rounded rectangle centred on (cx, cy), sx long along `ang` and sy across it. */
function rotRect(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  r: number,
  ang: number,
): Sample[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return rrect(-sx / 2, -sy / 2, sx / 2, sy / 2, r).map((q) => ({
    u: cx + q.u * c - q.v * s,
    v: cy + q.u * s + q.v * c,
    nu: q.nu * c - q.nv * s,
    nv: q.nu * s + q.nv * c,
  }));
}
function circ(cx: number, cy: number, R: number, n = 12): Sample[] {
  const out: Sample[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    out.push({
      u: cx + R * Math.cos(a),
      v: cy + R * Math.sin(a),
      nu: Math.cos(a),
      nv: Math.sin(a),
    });
  }
  return out;
}
const ringAt = (ring: Sample[], z: number) => ring.map((q) => P(q.u, q.v, z));
function run(ring: Sample[], keep: (q: Sample) => boolean) {
  const n = ring.length;
  let s = -1;
  for (let i = 0; i < n; i++)
    if (keep(ring[i]) && !keep(ring[(i + n - 1) % n])) {
      s = i;
      break;
    }
  if (s < 0) return keep(ring[0]) ? ring.slice() : [];
  const out: Sample[] = [];
  for (let k = 0; k < n && keep(ring[(s + k) % n]); k++)
    out.push(ring[(s + k) % n]);
  return out;
}
function hull(input: Pt[]): Pt[] {
  const pts = input
    .slice()
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .filter(
      (p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1],
    );
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    )
      lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    )
      upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
/** A solid standing from z0 to z1: its silhouette and one crease on the lid. */
function prism(ring: Sample[], inner: Sample[] | null, z0: number, z1: number) {
  return {
    sil: poly(hull(ringAt(ring, z1).concat(ringAt(ring, z0)))),
    crease: inner ? open(ringAt(run(inner, front), z1)) : "",
  };
}
/** A solid whose top is smaller than its foot. */
function taper(
  foot: Sample[],
  top: Sample[],
  inner: Sample[],
  z0: number,
  z1: number,
) {
  return {
    sil: poly(hull(ringAt(foot, z0).concat(ringAt(top, z1)))),
    crease: open(ringAt(run(inner, front), z1)),
  };
}
const inset = (ring: Sample[], b: number) =>
  ring.map((q) => ({ ...q, u: q.u - q.nu * b, v: q.v - q.nv * b }));

// ---- the clocks ----------------------------------------------------------
const spring = (x: number, k = 100, c = 18): Spring => ({
  x,
  v: 0,
  t: x,
  k,
  c,
});
function stepS(sp: Spring, dt: number, snap: boolean) {
  if (snap) {
    sp.x = sp.t;
    sp.v = 0;
    return false;
  }
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    sp.v += (-sp.k * (sp.x - sp.t) - sp.c * sp.v) * h;
    sp.x += sp.v * h;
  }
  if (Math.abs(sp.x - sp.t) < 0.01 && Math.abs(sp.v) < 0.1) {
    sp.x = sp.t;
    sp.v = 0;
    return false;
  }
  return true;
}
/** Terrain's falloff: 1 at the pointer, .31 at 42% of the radius, .09 beyond. */
const falloff = (u: number) =>
  u <= 0
    ? 1
    : u <= 0.417
      ? 1 - (u / 0.417) * 0.6875
      : u <= 1
        ? 0.3125 - ((u - 0.417) / 0.583) * 0.2185
        : 0.094;

// ---- drawing -------------------------------------------------------------
const NS = "http://www.w3.org/2000/svg";
type Solid = { g: SVGGElement; sil: SVGPathElement; cr: SVGPathElement };
function mk<T extends SVGElement>(tag: string, parent: Element, cls = "") {
  const e = document.createElementNS(NS, tag) as T;
  if (cls) e.setAttribute("class", cls);
  parent.appendChild(e);
  return e;
}
function solid(parent: Element): Solid {
  const g = mk<SVGGElement>("g", parent);
  return {
    g,
    sil: mk<SVGPathElement>("path", g, "sil"),
    cr: mk<SVGPathElement>("path", g, "cr"),
  };
}
function put(s: Solid, p: { sil: string; crease: string }) {
  s.sil.setAttribute("d", p.sil);
  s.cr.setAttribute("d", p.crease);
}

// ---- the scene -----------------------------------------------------------
// The grid: u runs along the city (down-right on screen, 22° off level),
// v across it toward the viewer. Footprints stay square to the world axes.
const CELL = 18;
const UANG = -Math.PI / 4 + 0.26;
const UX = Math.cos(UANG);
const UY = Math.sin(UANG);
const W = (u: number, v: number): Pt => [
  (u * UX - v * UY) * CELL,
  (u * UY + v * UX) * CELL,
];
const Winv = (x: number, y: number): Pt => [
  (x * UX + y * UY) / CELL,
  (-x * UY + y * UX) / CELL,
];
const RAIL_V = 0.58;
const RAIL_Z = 24;
const RISE = 12;
const RADIUS = 2.6 * CELL;

type Tower = {
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  h: number;
  kind: "box" | "tiered" | "spire";
  parts: Solid[];
  wall: 0 | 1 | 2;
  sp: Spring;
  drawn: number;
};

function seeded(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function ZeroDaySkyline({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    // The overlay ignores the pointer, so listen on the card around it.
    const stage: HTMLElement | SVGSVGElement =
      svg.closest<HTMLElement>("[data-skyline-stage]") ??
      svg.parentElement ??
      svg;
    const rnd = seeded(20261107);
    const rmq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const root = mk<SVGGElement>("g", svg);
    const far = mk<SVGGElement>("g", root);
    const railG = mk<SVGGElement>("g", root);
    const mid = mk<SVGGElement>("g", root);
    const air = mk<SVGGElement>("g", root);

    // -- towers, two rows, rising to the right, staggered half a cell --------
    const towers: Tower[] = [];
    const roofs: { cx: number; cy: number; z: number; row: number }[] = [];
    const rows = [
      { v: 0, base: 26, top: 82, gap: 0.3, fp: [13, 21], g: far },
      { v: 1.2, base: 8, top: 38, gap: 0.42, fp: [8, 14], g: mid },
    ];
    const N = 19;
    for (const row of rows) {
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        if (rnd() < row.gap * (1.4 - t)) continue;
        const u = i + (row.v ? 0.5 : 0);
        const [cx, cy] = W(u, row.v);
        const sx = row.fp[0] + rnd() * (row.fp[1] - row.fp[0]);
        const sy = sx * (0.7 + rnd() * 0.6);
        const env = row.base + (row.top - row.base) * Math.pow(t, 1.4);
        let h = env * (0.6 + rnd() * 0.6);
        let kind: Tower["kind"] = "box";
        if (row.v === 0 && i === 13) {
          kind = "spire";
          h = 90;
        } else if (row.v === 0 && rnd() < 0.35) kind = "tiered";
        const wall: Tower["wall"] =
          kind !== "spire" && rnd() < (row.v ? 0.3 : 0.5)
            ? rnd() < 0.5
              ? 1
              : 2
            : 0;
        const parts = [solid(row.g), solid(row.g), solid(row.g), solid(row.g)];
        towers.push({
          cx,
          cy,
          sx,
          sy,
          h,
          kind,
          parts,
          wall,
          sp: spring(h),
          drawn: NaN,
        });
        roofs.push({ cx, cy, z: h, row: row.v });
      }
    }
    const spireT = towers.find((t) => t.kind === "spire")!;
    const marks: Solid[] = [];
    function drawTower(t: Tower) {
      const h = t.sp.x;
      if (h === t.drawn) return;
      t.drawn = h;
      const r = Math.min(2, t.sx / 5);
      const [p0, p1, p2] = t.parts;
      if (t.kind === "box") {
        const ring = rrect(
          t.cx - t.sx / 2,
          t.cy - t.sy / 2,
          t.cx + t.sx / 2,
          t.cy + t.sy / 2,
          r,
        );
        put(p0, prism(ring, inset(ring, 0.9), 0, h));
        const b = rrect(
          t.cx + t.sx * 0.05,
          t.cy - t.sy * 0.3,
          t.cx + t.sx * 0.35,
          t.cy,
          1,
        );
        put(p1, prism(b, inset(b, 0.5), h, h + 2.6));
        p2.sil.removeAttribute("d");
        p2.cr.removeAttribute("d");
      } else if (t.kind === "tiered") {
        const h1 = h * 0.58;
        const h2 = h * 0.86;
        const a = rrect(
          t.cx - t.sx / 2,
          t.cy - t.sy / 2,
          t.cx + t.sx / 2,
          t.cy + t.sy / 2,
          r,
        );
        const b = rrect(
          t.cx - t.sx * 0.36 + 1,
          t.cy - t.sy * 0.36 - 1,
          t.cx + t.sx * 0.36 + 1,
          t.cy + t.sy * 0.36 - 1,
          r * 0.8,
        );
        const c = rrect(
          t.cx - t.sx * 0.22 + 1.6,
          t.cy - t.sy * 0.22 - 1.6,
          t.cx + t.sx * 0.22 + 1.6,
          t.cy + t.sy * 0.22 - 1.6,
          r * 0.6,
        );
        put(p0, prism(a, inset(a, 0.9), 0, h1));
        put(p1, prism(b, inset(b, 0.7), h1, h2));
        put(p2, prism(c, inset(c, 0.5), h2, h));
      } else {
        const foot = rrect(
          t.cx - t.sx / 2,
          t.cy - t.sy / 2,
          t.cx + t.sx / 2,
          t.cy + t.sy / 2,
          r,
        );
        const top = rrect(
          t.cx - t.sx * 0.2,
          t.cy - t.sy * 0.2,
          t.cx + t.sx * 0.2,
          t.cy + t.sy * 0.2,
          1,
        );
        put(p0, prism(foot, inset(foot, 0.9), 0, h * 0.7));
        put(p1, taper(foot, top, inset(top, 0.6), h * 0.7, h));
        const mast = rrect(
          t.cx - 0.7,
          t.cy - 0.7,
          t.cx + 0.7,
          t.cy + 0.7,
          0.35,
        );
        put(p2, prism(mast, null, h, h + 18));
      }
      // A billboard standing off a camera-facing wall, riding the tower's height.
      const p3 = t.parts[3];
      if (t.wall) {
        const w = Math.max(6, (t.wall === 1 ? t.sy : t.sx) * 0.62);
        const ph = clamp(h * 0.3, 5, 10);
        const z0 = t.kind === "tiered" ? h * 0.2 : h * 0.4;
        const ring =
          t.wall === 1
            ? rrect(
                t.cx + t.sx / 2 + 0.5,
                t.cy - w / 2,
                t.cx + t.sx / 2 + 1.3,
                t.cy + w / 2,
                0.3,
              )
            : rrect(
                t.cx - w / 2,
                t.cy + t.sy / 2 + 0.5,
                t.cx + w / 2,
                t.cy + t.sy / 2 + 1.3,
                0.3,
              );
        put(p3, prism(ring, inset(ring, 0.5), z0, z0 + ph));
      } else {
        p3.sil.removeAttribute("d");
        p3.cr.removeAttribute("d");
      }
    }

    // -- the monorail: pylons, a rail along u between the rows, one train ----
    const RAIL_ANG = UANG;
    const uMin = -0.6;
    const uMax = N - 0.2;
    const railLen = (uMax - uMin) * CELL;
    const [rcx, rcy] = W((uMin + uMax) / 2, RAIL_V);
    for (let u = uMin + 0.6; u < uMax; u += 2.5) {
      const [px, py] = W(u, RAIL_V);
      const ring = rrect(px - 1.6, py - 1.6, px + 1.6, py + 1.6, 0.8);
      put(solid(railG), prism(ring, null, 0, RAIL_Z));
    }
    const railRing = rotRect(rcx, rcy, railLen, 4.2, 1.2, RAIL_ANG);
    put(
      solid(railG),
      prism(railRing, inset(railRing, 0.9), RAIL_Z, RAIL_Z + 2.4),
    );
    const train = solid(railG);
    const trainRoof = solid(railG);
    let trainU = 4;
    let trainDrawn = NaN;
    const rate = spring(1, 60, 14);
    function drawTrain() {
      if (trainU === trainDrawn) return;
      trainDrawn = trainU;
      const [tx, ty] = W(trainU, RAIL_V);
      const body = rotRect(tx, ty, 17, 3.8, 1.6, RAIL_ANG);
      put(train, prism(body, inset(body, 0.7), RAIL_Z + 2.4, RAIL_Z + 7.2));
      const roof = rotRect(tx, ty, 7, 2.2, 1, RAIL_ANG);
      put(trainRoof, prism(roof, null, RAIL_Z + 7.2, RAIL_Z + 8.2));
    }

    // -- billboards on two far roofs, turning toward the pointer -------------
    type Board = {
      cx: number;
      cy: number;
      z: number;
      w: number;
      sp: Spring;
      drawn: number;
      el: Solid;
      posts: Solid[];
    };
    const boards: Board[] = [];
    const boardRoofs = roofs
      .filter((r) => r.z > 20 && r.z < 66 && r.cx !== spireT.cx)
      .sort((a, b) => a.cx - b.cx);
    const picked = new Set<number>();
    for (const f of [0.08, 0.3, 0.48, 0.66, 0.82, 0.96]) {
      const idx = Math.min(
        boardRoofs.length - 1,
        Math.floor(boardRoofs.length * f),
      );
      const r = boardRoofs[idx];
      if (!r || picked.has(idx)) continue;
      picked.add(idx);
      const g = r.row ? mid : far;
      boards.push({
        cx: r.cx,
        cy: r.cy,
        z: r.z,
        w: 8 + rnd() * 5,
        sp: spring(RAIL_ANG),
        drawn: NaN,
        el: solid(g),
        posts: [solid(g), solid(g)],
      });
    }
    function drawBoard(b: Board) {
      const a = b.sp.x;
      if (a === b.drawn) return;
      b.drawn = a;
      const c = Math.cos(a);
      const s = Math.sin(a);
      for (const [k, d] of [-(b.w / 2 - 1.6), b.w / 2 - 1.6].entries()) {
        const px = b.cx + d * c;
        const py = b.cy + d * s;
        put(
          b.posts[k],
          prism(
            rrect(px - 0.5, py - 0.5, px + 0.5, py + 0.5, 0.25),
            null,
            b.z,
            b.z + 6,
          ),
        );
      }
      const face = rotRect(b.cx, b.cy, b.w, 1.2, 0.5, a);
      put(b.el, prism(face, null, b.z + 4, b.z + 4 + b.w * 0.62));
    }

    // -- a tower crane on a far roof, its jib swinging toward the pointer ----
    const farRoofs = roofs
      .filter((r) => r.row === 0)
      .sort((a, b) => a.cx - b.cx);
    const craneRoof = farRoofs
      .slice(
        Math.floor(farRoofs.length * 0.5),
        Math.floor(farRoofs.length * 0.8),
      )
      .sort((a, b) => a.z - b.z)[0];
    const craneZ = craneRoof.z;
    const craneMast = solid(far);
    put(
      craneMast,
      prism(
        rrect(
          craneRoof.cx - 1.4,
          craneRoof.cy - 1.4,
          craneRoof.cx + 1.4,
          craneRoof.cy + 1.4,
          0.5,
        ),
        null,
        craneZ,
        craneZ + 26,
      ),
    );
    const jib = solid(far);
    const counter = solid(far);
    const cab = solid(far);
    const hookLine = mk<SVGPathElement>("path", far, "lo nf");
    const hook = solid(far);
    const craneA = spring(RAIL_ANG + 0.5, 60, 14);
    let craneDrawn = NaN;
    function drawCrane() {
      const a = craneA.x;
      if (a === craneDrawn) return;
      craneDrawn = a;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const top = craneZ + 26;
      const cabR = rrect(
        craneRoof.cx - 2.4,
        craneRoof.cy - 2.4,
        craneRoof.cx + 2.4,
        craneRoof.cy + 2.4,
        0.8,
      );
      put(cab, prism(cabR, inset(cabR, 0.6), top, top + 3));
      const J = 24;
      put(
        jib,
        prism(
          rotRect(
            craneRoof.cx + (J / 2 + 1) * c,
            craneRoof.cy + (J / 2 + 1) * s,
            J,
            1.6,
            0.6,
            a,
          ),
          null,
          top + 3,
          top + 4.6,
        ),
      );
      put(
        counter,
        prism(
          rotRect(craneRoof.cx - 7 * c, craneRoof.cy - 7 * s, 11, 2.2, 0.6, a),
          null,
          top + 3,
          top + 4.6,
        ),
      );
      const tipX = craneRoof.cx + J * 0.85 * c;
      const tipY = craneRoof.cy + J * 0.85 * s;
      const a1 = P(tipX, tipY, top + 3);
      const a2 = P(tipX, tipY, top - 12);
      hookLine.setAttribute(
        "d",
        `M${r2(a1[0])} ${r2(a1[1])}L${r2(a2[0])} ${r2(a2[1])}`,
      );
      put(
        hook,
        prism(
          rrect(tipX - 1.4, tipY - 1, tipX + 1.4, tipY + 1, 0.5),
          null,
          top - 14.5,
          top - 12,
        ),
      );
    }

    // -- a mast with cables to its neighbours, far right ----------------------
    const mastRoof = roofs
      .filter(
        (r) =>
          r.row === 0 &&
          r.cx !== spireT.cx &&
          r !== craneRoof &&
          !boards.some((b) => b.cx === r.cx),
      )
      .sort((a, b) => b.cx - a.cx)[1];
    const mastTop = mastRoof.z + 15;
    put(
      solid(far),
      prism(
        rrect(
          mastRoof.cx - 0.8,
          mastRoof.cy - 0.8,
          mastRoof.cx + 0.8,
          mastRoof.cy + 0.8,
          0.4,
        ),
        null,
        mastRoof.z,
        mastTop,
      ),
    );
    for (const dz of [4, 9]) {
      const bar = rotRect(
        mastRoof.cx,
        mastRoof.cy,
        7 - dz * 0.4,
        0.8,
        0.3,
        RAIL_ANG,
      );
      put(solid(far), prism(bar, null, mastTop - dz, mastTop - dz + 0.8));
    }
    const cables = mk<SVGGElement>("g", air);
    function wire(from: Pt, to: Pt, sag: number) {
      const m = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + sag];
      const c = mk<SVGPathElement>("path", cables, "lo nf");
      c.setAttribute(
        "d",
        `M${r2(from[0])} ${r2(from[1])}Q${r2(m[0])} ${r2(m[1])} ${r2(to[0])} ${r2(to[1])}`,
      );
    }
    const mastTip = P(mastRoof.cx, mastRoof.cy, mastTop);
    wire(mastTip, P(spireT.cx, spireT.cy, spireT.h + 16), 7);
    for (const b of boards.slice(-1))
      wire(mastTip, P(b.cx, b.cy, b.z + 4 + b.w * 0.62), 7);

    // -- rooftop poles strung together along the far row ---------------------
    const POLE = 7;
    const poles = farRoofs.filter(
      (r, i) =>
        i % 2 === 0 &&
        r !== craneRoof &&
        r !== mastRoof &&
        r.cx !== spireT.cx &&
        !boards.some((b) => b.cx === r.cx),
    );
    for (const r of poles) {
      put(
        solid(far),
        prism(
          rrect(r.cx - 0.5, r.cy - 0.5, r.cx + 0.5, r.cy + 0.5, 0.25),
          null,
          r.z,
          r.z + POLE,
        ),
      );
    }
    for (let i = 1; i < poles.length; i++) {
      const a = poles[i - 1];
      const b = poles[i];
      const pa = P(a.cx, a.cy, a.z + POLE);
      const pb = P(b.cx, b.cy, b.z + POLE);
      const sag = 3 + Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * 0.07;
      wire(pa, pb, sag);
      wire(
        P(a.cx, a.cy, a.z + POLE - 1.6),
        P(b.cx, b.cy, b.z + POLE - 1.6),
        sag + 1,
      );
    }
    for (const r of poles
      .filter((r) => Math.abs(r.cx - spireT.cx) < CELL * 6)
      .slice(0, 2)) {
      wire(
        P(spireT.cx, spireT.cy, spireT.h + 10),
        P(r.cx, r.cy, r.z + POLE),
        8,
      );
    }

    // -- drones, each on its own patrol loop over the city, shying from the pointer
    type Drone = {
      u0: number;
      v0: number;
      au: number;
      av: number;
      wu: number;
      wv: number;
      ph: number;
      z: number;
      x: number;
      y: number;
      ox: Spring;
      oy: Spring;
      body: Solid;
      rotors: SVGPathElement[];
      drawnKey: string;
    };
    const drones: Drone[] = [];
    for (const [u0, v0, au, av, wu, wv, ph, z] of [
      [4.6, 1.0, 3.4, 0.9, 0.21, 0.34, 0, 56],
      [10.4, 1.5, 4.6, 1.3, 0.16, 0.26, 2.1, 72],
      [15.4, 0.3, 3.0, 1.1, 0.27, 0.18, 4.2, 104],
    ]) {
      const [x, y] = W(u0, v0);
      const body = solid(air);
      const rotors = [0, 1, 2, 3].map(() =>
        mk<SVGPathElement>("path", air, "lo"),
      );
      drones.push({
        u0,
        v0,
        au,
        av,
        wu,
        wv,
        ph,
        z,
        x,
        y,
        ox: spring(0, 40, 12),
        oy: spring(0, 40, 12),
        body,
        rotors,
        drawnKey: "",
      });
    }
    function drawDrone(d: Drone, t: number) {
      const gu = d.u0 + d.au * Math.sin(d.wu * t + d.ph);
      const gv = d.v0 + d.av * Math.cos(d.wv * t + d.ph);
      const du = d.au * d.wu * Math.cos(d.wu * t + d.ph);
      const dv = -d.av * d.wv * Math.sin(d.wv * t + d.ph);
      const [bx, by] = W(gu, gv);
      d.x = bx;
      d.y = by;
      const [hx, hy] = W(du, dv);
      const ang = Math.atan2(hy, hx);
      const x = bx + d.ox.x;
      const y = by + d.oy.x;
      const z = d.z + Math.sin(t * 1.3 + d.ph) * 2.2;
      const key = `${r2(x)},${r2(y)},${r2(z)},${r2(ang)}`;
      if (key === d.drawnKey) return;
      d.drawnKey = key;
      put(d.body, prism(rotRect(x, y, 5, 3.6, 1, ang), null, z, z + 1.4));
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].forEach(([dx, dy], k) => {
        const rx = x + (dx * 3.2 * c - dy * 3.2 * sn);
        const ry = y + (dx * 3.2 * sn + dy * 3.2 * c);
        d.rotors[k].setAttribute(
          "d",
          poly(ringAt(circ(rx, ry, 1.8, 10), z + 1.6)),
        );
      });
    }

    // -- the blinking lamp on the spire ---------------------------------------
    const lamp = mk<SVGCircleElement>("circle", air, "dot");
    lamp.setAttribute("r", "1.3");
    const lp = P(spireT.cx, spireT.cy, spireT.h + 18);
    lamp.setAttribute("cx", String(r2(lp[0])));
    lamp.setAttribute("cy", String(r2(lp[1])));

    // -- the frame: fit the rest pose plus headroom, anchored bottom-right ----
    {
      const pts: Pt[] = [];
      for (const t of towers) {
        pts.push(
          P(t.cx - t.sx / 2, t.cy + t.sy / 2, 0),
          P(t.cx + t.sx / 2, t.cy - t.sy / 2, 0),
        );
        pts.push(P(t.cx, t.cy, t.h + RISE + (t.kind === "spire" ? 20 : 4)));
      }
      pts.push(P(craneRoof.cx, craneRoof.cy, craneZ + 32));
      for (const d of drones)
        for (const [su, sv] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          const [x, y] = W(d.u0 + su * d.au, d.v0 + sv * d.av);
          pts.push(P(x, y, d.z + 6));
        }
      pts.push(
        P(W(uMin, RAIL_V)[0], W(uMin, RAIL_V)[1], 0),
        P(W(uMax, RAIL_V)[0], W(uMax, RAIL_V)[1], 0),
      );
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs) - 30;
      const y0 = Math.min(...ys) - 8;
      const x1 = Math.max(...xs) + 8;
      const y1 = Math.max(...ys) + 2;
      svg.setAttribute(
        "viewBox",
        `${r2(x0)} ${r2(y0)} ${r2(x1 - x0)} ${r2(y1 - y0)}`,
      );
    }

    // -- the loop --------------------------------------------------------------
    let over: Pt | null = null;
    let hot: Tower | null = null;
    let raf = 0;
    let last = 0;
    let visible = true;
    let clock = 0;
    let lampOn = true;

    function retarget() {
      let nearest: Tower | null = null;
      let best = Infinity;
      for (const t of towers) {
        if (!over) {
          t.sp.t = t.h;
          continue;
        }
        const d = Math.hypot(t.cx - over[0], t.cy - over[1]);
        t.sp.t = t.h + RISE * falloff(d / RADIUS);
        const inside =
          Math.abs(t.cx - over[0]) < t.sx / 2 + 3 &&
          Math.abs(t.cy - over[1]) < t.sy / 2 + 3;
        if (inside && d < best) {
          best = d;
          nearest = t;
        }
      }
      if (nearest !== hot) {
        hot?.parts.forEach((p) => p.sil.classList.remove("hi"));
        hot = nearest;
        hot?.parts.forEach((p) => p.sil.classList.add("hi"));
        spireT.parts.forEach((p) => p.sil.classList.toggle("hi", !hot));
      }
      for (const b of boards) {
        b.sp.t = over
          ? RAIL_ANG +
            clamp(
              Math.atan2(over[1] - b.cy, over[0] - b.cx) +
                Math.PI / 2 -
                RAIL_ANG,
              -0.7,
              0.7,
            )
          : RAIL_ANG;
      }
      craneA.t = over
        ? RAIL_ANG +
          0.5 +
          clamp(
            Math.atan2(over[1] - craneRoof.cy, over[0] - craneRoof.cx) -
              RAIL_ANG -
              0.5,
            -1.2,
            1.2,
          )
        : RAIL_ANG + 0.5;
      for (const d of drones) {
        if (!over) {
          d.ox.t = 0;
          d.oy.t = 0;
          continue;
        }
        const dx = d.x - over[0];
        const dy = d.y - over[1];
        const dist = Math.hypot(dx, dy);
        const push = clamp((RADIUS * 1.4 - dist) / (RADIUS * 1.4), 0, 1) * 16;
        d.ox.t = dist < 1 ? push : (dx / dist) * push;
        d.oy.t = dist < 1 ? 0 : (dy / dist) * push;
      }
      if (over) {
        const [, ov] = Winv(over[0], over[1]);
        rate.t = Math.abs(ov - RAIL_V) * CELL < 10 ? 0.15 : 1;
      } else rate.t = 1;
      wake();
    }

    function tick(now: number) {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const snap = rmq.matches;
      let moving = false;
      for (const t of towers) {
        if (stepS(t.sp, dt, snap)) moving = true;
        drawTower(t);
      }
      for (const b of boards) {
        if (stepS(b.sp, dt, snap)) moving = true;
        drawBoard(b);
      }
      if (stepS(craneA, dt, snap)) moving = true;
      drawCrane();
      if (stepS(rate, dt, snap)) moving = true;
      if (!snap) {
        clock += dt * rate.x;
        trainU += dt * rate.x * 1.6;
        if (trainU > uMax + 1.2) trainU = uMin - 1.2;
        moving = true;
      }
      drawTrain();
      for (const d of drones) {
        if (stepS(d.ox, dt, snap)) moving = true;
        if (stepS(d.oy, dt, snap)) moving = true;
        drawDrone(d, snap ? 0 : clock);
      }
      const on = snap || Math.floor(clock / 0.9) % 2 === 0;
      if (on !== lampOn) {
        lampOn = on;
        lamp.setAttribute("class", on ? "dot" : "dot off");
      }
      if (moving && visible && !document.hidden)
        raf = requestAnimationFrame(tick);
      else last = 0;
    }
    function wake() {
      if (!raf && visible && !document.hidden)
        raf = requestAnimationFrame(tick);
    }

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) wake();
    });
    io.observe(stage);
    const onVis = () => wake();
    document.addEventListener("visibilitychange", onVis);

    const toWorld = (e: PointerEvent): Pt | null => {
      const m = svg.getScreenCTM();
      if (!m) return null;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(
        m.inverse(),
      );
      return unproj(pt.x, pt.y, 0);
    };
    let leaveT = 0;
    const onMove = (e: PointerEvent) => {
      window.clearTimeout(leaveT);
      over = toWorld(e);
      retarget();
    };
    const onLeave = (e: PointerEvent) => {
      window.clearTimeout(leaveT);
      leaveT = window.setTimeout(
        () => {
          over = null;
          retarget();
        },
        e.pointerType === "mouse" ? 0 : 1400,
      );
    };
    const el = stage as HTMLElement;
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onMove);
    el.addEventListener("pointerleave", onLeave);

    spireT.parts.forEach((p) => p.sil.classList.add("hi"));
    marks.length = 0;
    wake();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(leaveT);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onMove);
      el.removeEventListener("pointerleave", onLeave);
      svg.replaceChildren();
    };
  }, []);

  return (
    <svg
      ref={ref}
      aria-hidden
      preserveAspectRatio="xMaxYMax meet"
      className={`zd-sky pointer-events-none absolute inset-0 h-full w-full select-none ${className}`}
    >
      <style>{`
        .zd-sky path,.zd-sky circle{fill:#0B0C15;stroke:rgba(255,255,255,.4);stroke-width:1;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round;transition:stroke 260ms cubic-bezier(.32,.72,0,1)}
        .zd-sky .sil{stroke:rgba(255,255,255,.72)}
        .zd-sky .cr{stroke:rgba(255,255,255,.34)}
        .zd-sky .lo{stroke:rgba(255,255,255,.22)}
        .zd-sky .hi{stroke:#fff}
        .zd-sky .nf{fill:none}
        .zd-sky .dot{stroke:none;fill:#fff;transition:fill 260ms}
        .zd-sky .dot.off{fill:rgba(255,255,255,.2)}
      `}</style>
    </svg>
  );
}

/**
 * The city as a card backdrop: fills the card, fades out under the text on
 * the left, ignores the pointer. The card needs `relative overflow-hidden`
 * and `data-skyline-stage` so the figure can listen to the pointer on it.
 */
export function ZeroDaySkylineBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 select-none overflow-hidden opacity-80 [mask-image:linear-gradient(to_right,transparent_26%,black_62%)]"
    >
      <div className="absolute -bottom-[10%] right-0 h-[120%] w-[120%]">
        <ZeroDaySkyline />
      </div>
    </div>
  );
}
