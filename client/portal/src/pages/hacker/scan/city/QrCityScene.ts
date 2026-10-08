import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { footprintOutline } from "./footprint";
import {
  type CityCell,
  type CityLayout,
  createRng,
  FACADE_COLORS,
  hashSeed,
  NEON,
  PLATE_COLOR,
  PLAZA_COLORS,
  QUIET_ZONE,
  ROOF_COLOR,
  type WindowPalette,
} from "./qrCity";

const ISO_ELEVATION = THREE.MathUtils.degToRad(35);
const ISO_AZIMUTH = THREE.MathUtils.degToRad(45);
const TOP_ELEVATION = Math.PI / 2;
const CAMERA_DISTANCE = 160;
/** Fraction of the plate size used as the ortho half-extent in the iso view. */
const ISO_FRAME_SCALE = 0.78;
const ISO_TARGET_Y = 6.5;

/** Gap between a block and the edge of the modules it covers. */
const BUILDING_GAP = 0.16;
const PLATE_THICKNESS = 1;
const PLAZA_THICKNESS = 0.06;

const BLOOM_STRENGTH = 0.85;
const BLOOM_RADIUS = 0.55;
const BLOOM_THRESHOLD = 0.55;
const EMISSIVE_INTENSITY = 1.6;

/** Window rows per unit of building height, and columns per face. */
const WINDOW_ROWS_PER_UNIT = 2;
const WINDOW_COLS = 3;
const WINDOW_TEXTURE_ROWS = 16;
const WINDOW_PX = 16;

const CRANE_COLOR = "#ffb020";
const PROP_DARK = "#0d0e18";
const HELI_HEIGHT = 19;
const HELI_RADIUS = 10;
const HELI_SPEED = 0.45;
const HELI_SCALE = 1.8;
const SIGN_GLOW = 1.2;

const UP_ISO = new THREE.Vector3(0, 1, 0);
const UP_TOP = new THREE.Vector3(0, 0, -1);

function paintWindowTexture(palette: WindowPalette, seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = WINDOW_COLS * WINDOW_PX;
  canvas.height = WINDOW_TEXTURE_ROWS * WINDOW_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rng = createRng(seed + palette);
  const primary = palette === 0 ? NEON.magenta : NEON.cyan;
  const secondary = palette === 0 ? NEON.cyan : NEON.magenta;
  const inset = 4;
  for (let row = 0; row < WINDOW_TEXTURE_ROWS; row++) {
    for (let col = 0; col < WINDOW_COLS; col++) {
      const roll = rng();
      if (roll > 0.42) continue;
      ctx.fillStyle =
        roll < 0.22 ? primary : roll < 0.32 ? secondary : NEON.violet;
      ctx.fillRect(
        col * WINDOW_PX + inset,
        row * WINDOW_PX + inset,
        WINDOW_PX - inset * 2,
        WINDOW_PX - inset * 2,
      );
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Neon "copy" on a dark panel: bars of varying width, like a sign seen far away. */
function paintBillboardTexture(seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rng = createRng(seed ^ 0x9e3779b9);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(3, 3, canvas.width - 6, 2);
  for (let row = 0; row < 3; row++) {
    let x = 5;
    const y = 9 + row * 7;
    while (x < canvas.width - 8) {
      const w = 3 + Math.floor(rng() * 7);
      ctx.fillRect(x, y, Math.min(w, canvas.width - 5 - x), 4);
      x += w + 2;
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** The footprint module nearest the bounding-box centre, for rooftop props. */
function roofModule(cell: CityCell): [number, number] {
  const cr = cell.row + (cell.h - 1) / 2;
  const cc = cell.col + (cell.w - 1) / 2;
  return cell.modules.reduce((best, m) =>
    Math.hypot(m[0] - cr, m[1] - cc) < Math.hypot(best[0] - cr, best[1] - cc)
      ? m
      : best,
  );
}

/**
 * Extrudes a footprint straight up. Group 0 is the caps (roof), group 1 the
 * walls, whose UVs are rescaled so one repeating window texture fits any
 * height: u runs in module units, v in window rows.
 */
function createFootprintGeometry(
  cell: CityCell,
  moduleCount: number,
): THREE.BufferGeometry {
  const half = moduleCount / 2;
  const shapes = footprintOutline(cell.modules, BUILDING_GAP).map((outline) => {
    const toVec = ([x, y]: [number, number]) =>
      new THREE.Vector2(x - half, -(y - half));
    const shape = new THREE.Shape(outline.outer.map(toVec));
    for (const hole of outline.holes) {
      shape.holes.push(new THREE.Path(hole.map(toVec)));
    }
    return shape;
  });
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: cell.height,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const walls = geometry.groups[1];
  if (walls) {
    const index = geometry.getIndex();
    const rows = WINDOW_ROWS_PER_UNIT / WINDOW_TEXTURE_ROWS;
    const seen = new Set<number>();
    for (let i = walls.start; i < walls.start + walls.count; i++) {
      const v = index ? index.getX(i) : i;
      if (seen.has(v)) continue;
      seen.add(v);
      uv.setXY(v, uv.getX(v), position.getY(v) * rows);
    }
    uv.needsUpdate = true;
  }
  return geometry;
}

/**
 * Imperative three.js scene for a hacker's QR city. `setProgress(0)` is the
 * isometric night view, `setProgress(1)` is straight down with the neon off,
 * where the rooftops form the QR code. Rendering is on demand only.
 */
export class QrCityScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly buildingMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly glowMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly props = new THREE.Group();
  private readonly helicopter = new THREE.Group();
  private rotor: THREE.Mesh | null = null;
  private beacons: THREE.MeshStandardMaterial[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  private readonly plateSize: number;
  private readonly animate: boolean;
  private progress = 0;
  private frame = 0;
  private loopFrame = 0;
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    layout: CityLayout,
    options: { animate?: boolean } = {},
  ) {
    this.plateSize = layout.plateSize;
    this.animate = options.animate ?? true;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);

    this.scene.add(new THREE.HemisphereLight(0xc9c4ff, 0x1a0b2e, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-14, 22, 10);
    this.scene.add(sun);

    this.buildPlate(layout);
    this.buildBuildings(layout);
    this.buildProps(layout);
    this.buildHelicopter();
    this.scene.add(this.props, this.helicopter);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(256, 256),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.setProgress(0);
    this.startLoop();
  }

  /** Square canvas, CSS pixels. */
  setSize(size: number) {
    if (this.disposed || size <= 0) return;
    this.renderer.setSize(size, size, false);
    this.composer.setSize(size, size);
    this.requestRender();
  }

  /** 0 = isometric city, 1 = top-down QR. */
  setProgress(progress: number) {
    if (this.disposed) return;
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    this.progress = t;

    const half = THREE.MathUtils.lerp(
      this.plateSize * ISO_FRAME_SCALE,
      this.plateSize / 2,
      t,
    );
    this.camera.left = -half;
    this.camera.right = half;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();

    const elevation = THREE.MathUtils.lerp(ISO_ELEVATION, TOP_ELEVATION, t);
    const azimuth = THREE.MathUtils.lerp(ISO_AZIMUTH, 0, t);
    const target = new THREE.Vector3(
      0,
      THREE.MathUtils.lerp(ISO_TARGET_Y, 0, t),
      0,
    );
    this.camera.position.set(
      Math.cos(elevation) * Math.sin(azimuth) * CAMERA_DISTANCE,
      Math.sin(elevation) * CAMERA_DISTANCE,
      Math.cos(elevation) * Math.cos(azimuth) * CAMERA_DISTANCE,
    );
    this.camera.position.add(target);
    this.camera.up.copy(UP_ISO).lerp(UP_TOP, t).normalize();
    this.camera.lookAt(target);

    const glow = 1 - t;
    for (const material of this.buildingMaterials) {
      material.emissiveIntensity = EMISSIVE_INTENSITY * glow;
    }
    for (const material of this.glowMaterials) {
      material.emissiveIntensity = EMISSIVE_INTENSITY * SIGN_GLOW * glow;
    }
    this.bloom.strength = BLOOM_STRENGTH * glow;

    // Props may overhang neighbouring modules, so they shrink to nothing
    // before the view becomes the QR code.
    const propScale = Math.max(glow, 0.0001);
    for (const prop of this.props.children) prop.scale.setScalar(propScale);
    this.props.visible = glow > 0;
    this.helicopter.scale.setScalar(propScale);
    this.helicopter.visible = glow > 0;

    if (glow > 0) this.startLoop();
    this.requestRender();
  }

  getProgress() {
    return this.progress;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.loopFrame);
    for (const item of this.disposables) item.dispose();
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  private requestRender() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (!this.disposed) this.composer.render();
    });
  }

  /** Flies the helicopter while the city is in view; stops at the QR. */
  private startLoop() {
    if (!this.animate || this.loopFrame || this.disposed) return;
    const tick = (now: number) => {
      this.loopFrame = 0;
      if (this.disposed || this.progress >= 1) return;
      this.flyHelicopter(now / 1000);
      this.composer.render();
      this.loopFrame = requestAnimationFrame(tick);
    };
    this.loopFrame = requestAnimationFrame(tick);
  }

  private flyHelicopter(seconds: number) {
    const angle = seconds * HELI_SPEED;
    const x = Math.cos(angle) * HELI_RADIUS;
    const z = Math.sin(angle) * HELI_RADIUS;
    this.helicopter.position.set(
      x,
      HELI_HEIGHT + Math.sin(seconds * 1.3) * 0.4,
      z,
    );
    // Nose along the tangent of the orbit, banking slightly into the turn.
    this.helicopter.rotation.set(0, -angle, 0);
    this.helicopter.rotation.z = -0.12;
    if (this.rotor) this.rotor.rotation.y = seconds * 40;
    const blink = Math.floor(seconds * 2) % 2 === 0 ? 1 : 0;
    for (const beacon of this.beacons) {
      beacon.emissiveIntensity = (2 + blink * 4) * (1 - this.progress);
    }
  }

  private track<T extends { dispose(): void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private cellX(col: number, moduleCount: number) {
    return col + 0.5 - moduleCount / 2;
  }

  private cellZ(row: number, moduleCount: number) {
    return row + 0.5 - moduleCount / 2;
  }

  private buildPlate(layout: CityLayout) {
    const plateGeometry = this.track(
      new THREE.BoxGeometry(this.plateSize, PLATE_THICKNESS, this.plateSize),
    );
    const plateMaterial = this.track(
      new THREE.MeshStandardMaterial({
        color: PLATE_COLOR,
        roughness: 0.95,
      }),
    );
    const plate = new THREE.Mesh(plateGeometry, plateMaterial);
    plate.position.y = -PLATE_THICKNESS / 2;
    this.scene.add(plate);

    const n = layout.moduleCount;
    const lightCells: [number, number][] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!layout.modules[r][c]) lightCells.push([r, c]);
      }
    }
    if (lightCells.length === 0) return;

    const tileGeometry = this.track(
      new THREE.BoxGeometry(0.98, PLAZA_THICKNESS, 0.98),
    );
    const tileMaterial = this.track(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    );
    const tiles = new THREE.InstancedMesh(
      tileGeometry,
      tileMaterial,
      lightCells.length,
    );
    const matrix = new THREE.Matrix4();
    const colors = PLAZA_COLORS.map((hex) => new THREE.Color(hex));
    lightCells.forEach(([r, c], i) => {
      matrix.makeTranslation(
        this.cellX(c, n),
        PLAZA_THICKNESS / 2,
        this.cellZ(r, n),
      );
      tiles.setMatrixAt(i, matrix);
      tiles.setColorAt(i, colors[(r + c) % colors.length]);
    });
    tiles.instanceMatrix.needsUpdate = true;
    this.scene.add(tiles);
  }

  private buildBuildings(layout: CityLayout) {
    const seed = hashSeed(layout.value);
    const textures: Record<WindowPalette, THREE.CanvasTexture> = {
      0: this.track(paintWindowTexture(0, seed)),
      1: this.track(paintWindowTexture(1, seed)),
    };
    const facades = new Map<string, THREE.MeshStandardMaterial>();
    const facade = (palette: WindowPalette, tint: number) => {
      const key = `${palette}:${tint}`;
      let material = facades.get(key);
      if (!material) {
        material = this.createBuildingMaterial(
          textures[palette],
          FACADE_COLORS[tint],
        );
        facades.set(key, material);
      }
      return material;
    };
    // Rooftops are unlit so the top-down view is a flat, uniform dark.
    const roofMaterial = this.track(
      new THREE.MeshBasicMaterial({ color: ROOF_COLOR }),
    );

    for (const cell of layout.cells) {
      const geometry = this.track(
        createFootprintGeometry(cell, layout.moduleCount),
      );
      const mesh = new THREE.Mesh(geometry, [
        roofMaterial,
        facade(cell.palette, cell.tint),
      ]);
      this.scene.add(mesh);
    }
  }

  private buildProps(layout: CityLayout) {
    const n = layout.moduleCount;
    const seed = hashSeed(layout.value);
    const rng = createRng(seed ^ 0x51ed270b);

    const dark = this.track(
      new THREE.MeshStandardMaterial({ color: PROP_DARK, roughness: 0.8 }),
    );
    const steel = this.track(
      new THREE.MeshStandardMaterial({
        color: CRANE_COLOR,
        roughness: 0.5,
        metalness: 0.3,
      }),
    );
    const signTexture = this.track(paintBillboardTexture(seed));
    const signMaterials = [NEON.magenta, NEON.cyan, NEON.violet].map((hex) =>
      this.track(
        new THREE.MeshStandardMaterial({
          color: PROP_DARK,
          roughness: 0.6,
          emissive: new THREE.Color(hex),
          emissiveMap: signTexture,
          emissiveIntensity: EMISSIVE_INTENSITY * SIGN_GLOW,
        }),
      ),
    );
    this.glowMaterials.push(...signMaterials);
    const beacon = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x330000,
        emissive: 0xff2a2a,
        emissiveIntensity: 4,
      }),
    );
    this.beacons.push(beacon);

    const unitBox = this.track(new THREE.BoxGeometry(1, 1, 1));
    const box = (
      material: THREE.Material,
      size: [number, number, number],
      position: [number, number, number],
    ) => {
      const mesh = new THREE.Mesh(unitBox, material);
      mesh.scale.set(...size);
      mesh.position.set(...position);
      return mesh;
    };

    for (const cell of layout.cells) {
      if (!cell.billboard && !cell.crane) continue;
      const [row, col] = roofModule(cell);
      const inFootprint = (r: number, c: number) =>
        cell.modules.some(([mr, mc]) => mr === r && mc === c);
      const anchor = new THREE.Group();
      anchor.position.set(col + 0.5 - n / 2, cell.height, row + 0.5 - n / 2);

      if (cell.billboard) {
        const wide = inFootprint(row, col + 1);
        const panelW = wide ? 1.7 : 0.8;
        const sign = new THREE.Group();
        // Sits on the far edge of the module so it faces the iso camera.
        sign.position.z = -(1 - BUILDING_GAP) / 2 + 0.12;
        sign.position.x = wide ? 0.5 : 0;
        sign.add(box(dark, [0.08, 0.7, 0.08], [-panelW / 2 + 0.1, 0.35, 0]));
        sign.add(box(dark, [0.08, 0.7, 0.08], [panelW / 2 - 0.1, 0.35, 0]));
        sign.add(
          box(
            signMaterials[Math.floor(rng() * signMaterials.length)],
            [panelW, 1.3, 0.1],
            [0, 1.35, 0],
          ),
        );
        anchor.add(sign);
      }

      if (cell.crane) {
        const crane = new THREE.Group();
        crane.rotation.y = rng() * Math.PI * 2;
        const mast = 3.5;
        const jib = 2.8;
        crane.add(box(steel, [0.16, mast, 0.16], [0, mast / 2, 0]));
        crane.add(box(steel, [jib, 0.1, 0.1], [jib / 2 - 0.6, mast, 0]));
        crane.add(box(steel, [0.1, 0.5, 0.1], [-0.5, mast - 0.25, 0]));
        crane.add(box(dark, [0.4, 0.3, 0.3], [-0.6, mast - 0.4, 0]));
        const drop = 0.8 + rng() * 1.2;
        const hookX = jib - 0.9;
        crane.add(box(dark, [0.02, drop, 0.02], [hookX, mast - drop / 2, 0]));
        crane.add(box(dark, [0.3, 0.3, 0.3], [hookX, mast - drop - 0.15, 0]));
        crane.add(box(beacon, [0.12, 0.12, 0.12], [0, mast + 0.1, 0]));
        anchor.add(crane);
      }

      this.props.add(anchor);
    }
  }

  private buildHelicopter() {
    const body = this.track(
      new THREE.MeshStandardMaterial({ color: 0x8a92cc, roughness: 0.45 }),
    );
    const glass = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x9fe8ff,
        roughness: 0.2,
        metalness: 0.4,
        emissive: 0x22e0ff,
        emissiveIntensity: 0.6,
      }),
    );
    const strobe = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 4,
      }),
    );
    this.beacons.push(strobe);
    const blade = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.7,
      }),
    );
    const beacon = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x002200,
        emissive: 0x30ff60,
        emissiveIntensity: 4,
      }),
    );
    this.beacons.push(beacon);
    const unitBox = this.track(new THREE.BoxGeometry(1, 1, 1));
    const part = (
      material: THREE.Material,
      size: [number, number, number],
      position: [number, number, number],
    ) => {
      const mesh = new THREE.Mesh(unitBox, material);
      mesh.scale.set(...size).multiplyScalar(HELI_SCALE);
      mesh.position.set(...position).multiplyScalar(HELI_SCALE);
      this.helicopter.add(mesh);
      return mesh;
    };
    part(body, [1.4, 0.7, 0.8], [0, 0, 0]);
    part(glass, [0.5, 0.5, 0.7], [0.9, 0.05, 0]);
    part(body, [1.6, 0.16, 0.16], [-1.4, 0.15, 0]);
    part(body, [0.08, 0.7, 0.08], [-2.1, 0.35, 0]);
    part(body, [0.12, 0.12, 1.1], [0, -0.5, 0]);
    part(body, [0.1, 0.5, 0.1], [0, 0.6, 0]);
    this.rotor = part(blade, [3.4, 0.04, 0.22], [0, 0.85, 0]);
    part(beacon, [0.14, 0.14, 0.14], [-2.1, 0.75, 0]);
    part(strobe, [0.18, 0.1, 0.18], [0.2, -0.4, 0]);
    this.helicopter.position.set(HELI_RADIUS, HELI_HEIGHT, 0);
  }

  private createBuildingMaterial(texture: THREE.CanvasTexture, color: string) {
    this.track(texture);
    const material = this.track(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        metalness: 0.1,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: EMISSIVE_INTENSITY,
      }),
    );
    this.buildingMaterials.push(material);
    return material;
  }
}

export { QUIET_ZONE };
