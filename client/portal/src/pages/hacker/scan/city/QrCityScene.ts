import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import {
  BUILDING_COLOR,
  type CityCell,
  type CityLayout,
  createRng,
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
const ISO_TARGET_Y = 3.5;

/** Gap between a block and the edge of the modules it covers. */
const BUILDING_GAP = 0.16;
const ROOF_THICKNESS = 0.08;
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

function groupKey(cell: CityCell): string {
  return `${cell.w}:${cell.h}:${cell.height}:${cell.palette}`;
}

/**
 * Unit-height box with its base at y=0 whose side-face UVs span the face in
 * module units, so one repeating window texture fits every block size.
 */
function createBlockGeometry(w: number, h: number, height: number) {
  const geometry = new THREE.BoxGeometry(w - BUILDING_GAP, 1, h - BUILDING_GAP);
  geometry.translate(0, 0.5, 0);
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  const v = (height * WINDOW_ROWS_PER_UNIT) / WINDOW_TEXTURE_ROWS;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; four vertices each.
  const faceWidth = [h, h, 0, 0, w, w];
  for (let i = 0; i < uv.count; i++) {
    const width = faceWidth[Math.floor(i / 4)];
    uv.setXY(i, uv.getX(i) * width, uv.getY(i) * v);
  }
  uv.needsUpdate = true;
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
  private readonly disposables: { dispose(): void }[] = [];
  private readonly plateSize: number;
  private progress = 0;
  private frame = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, layout: CityLayout) {
    this.plateSize = layout.plateSize;

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
    this.bloom.strength = BLOOM_STRENGTH * glow;

    this.requestRender();
  }

  getProgress() {
    return this.progress;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
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
    const n = layout.moduleCount;
    const groups = new Map<string, CityCell[]>();
    for (const cell of layout.cells) {
      const key = groupKey(cell);
      const group = groups.get(key);
      if (group) group.push(cell);
      else groups.set(key, [cell]);
    }

    const seed = hashSeed(layout.value);
    const materials: Record<WindowPalette, THREE.MeshStandardMaterial> = {
      0: this.createBuildingMaterial(paintWindowTexture(0, seed)),
      1: this.createBuildingMaterial(paintWindowTexture(1, seed)),
    };

    const roofGeometry = this.track(
      new THREE.BoxGeometry(1, ROOF_THICKNESS, 1),
    );
    // Rooftops are unlit so the top-down view is a flat, uniform dark.
    const roofMaterial = this.track(
      new THREE.MeshBasicMaterial({ color: ROOF_COLOR }),
    );
    const roofs = new THREE.InstancedMesh(
      roofGeometry,
      roofMaterial,
      layout.cells.length,
    );

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    let roofIndex = 0;

    for (const cells of groups.values()) {
      const { w, h, height, palette } = cells[0];
      const geometry = this.track(createBlockGeometry(w, h, height));
      const bodies = new THREE.InstancedMesh(
        geometry,
        materials[palette],
        cells.length,
      );
      cells.forEach((cell, i) => {
        position.set(
          cell.col + cell.w / 2 - n / 2,
          0,
          cell.row + cell.h / 2 - n / 2,
        );
        scale.set(1, cell.height, 1);
        matrix.compose(position, quaternion, scale);
        bodies.setMatrixAt(i, matrix);

        position.y = cell.height + ROOF_THICKNESS / 2;
        scale.set(cell.w - BUILDING_GAP, 1, cell.h - BUILDING_GAP);
        matrix.compose(position, quaternion, scale);
        roofs.setMatrixAt(roofIndex++, matrix);
      });
      bodies.instanceMatrix.needsUpdate = true;
      this.scene.add(bodies);
    }

    roofs.instanceMatrix.needsUpdate = true;
    this.scene.add(roofs);
  }

  private createBuildingMaterial(texture: THREE.CanvasTexture) {
    this.track(texture);
    const material = this.track(
      new THREE.MeshStandardMaterial({
        color: BUILDING_COLOR,
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
