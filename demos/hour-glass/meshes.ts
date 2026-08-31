import {
  BOARD,
  BOARD_THICK,
  CAP_BOT_TOP,
  CAP_RADIUS,
  CAP_TOP_BOT,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  HOURGLASS_BOT,
  HOURGLASS_TOP,
  INLAY,
  MAT_BRASS,
  MAT_CAP_WOOD,
  MAT_CEILING,
  MAT_FRAME,
  MAT_INLAY,
  MAT_MAPLE,
  MAT_SAND,
  MAT_SHELF,
  MAT_TABLE,
  MAT_WALL,
  MAT_WALNUT,
  MAT_WINDOW,
  PILLAR_R,
  SQUARE,
  SQUARE_THICK,
  TABLE_SIZE,
} from "./constants";
import { glassRingY, outerRadius, outerRadiusDeriv, thickness } from "./profile";

export const STRIDE = 9;
export const PILE_WALL = 40;
export const PILE_CAP = 28;
export const PILE_SEGS = 48;
export const PILE_RINGS = PILE_WALL + PILE_CAP;

export type Mesh = {
  vertices: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
};

function pushVert(
  dst: number[],
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  u: number,
  v: number,
  extra: number,
) {
  const len = Math.hypot(nx, ny, nz) || 1;
  dst.push(px, py, pz, nx / len, ny / len, nz / len, u, v, extra);
}

function addBox(
  dst: number[],
  idx: number[],
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  material: number,
  uvScale = 1,
) {
  const hx = sx * 0.5;
  const hy = sy * 0.5;
  const hz = sz * 0.5;
  const faces: Array<[number, number, number, number, number, number, number, number]> = [
    [0, 0, 1, 0, 0, hz, hx, hy],
    [0, 0, -1, 0, 0, -hz, hx, hy],
    [1, 0, 0, hx, 0, 0, hz, hy],
    [-1, 0, 0, -hx, 0, 0, hz, hy],
    [0, 1, 0, 0, hy, 0, hx, hz],
    [0, -1, 0, 0, -hy, 0, hx, hz],
  ];
  for (const [nx, ny, nz, ox, oy, oz, au, av] of faces) {
    const tangent = orthonormal(nx, ny, nz);
    const bitan: [number, number, number] = [
      ny * tangent[2] - nz * tangent[1],
      nz * tangent[0] - nx * tangent[2],
      nx * tangent[1] - ny * tangent[0],
    ];
    const base = dst.length / STRIDE;
    const corners = [
      [-au, -av],
      [au, -av],
      [au, av],
      [-au, av],
    ];
    for (const [su, sv] of corners) {
      const px = cx + ox + tangent[0] * su + bitan[0] * sv;
      const py = cy + oy + tangent[1] * su + bitan[1] * sv;
      const pz = cz + oz + tangent[2] * su + bitan[2] * sv;
      pushVert(
        dst,
        px,
        py,
        pz,
        nx,
        ny,
        nz,
        (su / Math.max(au, 1e-6) * 0.5 + 0.5) * uvScale,
        (sv / Math.max(av, 1e-6) * 0.5 + 0.5) * uvScale,
        material,
      );
    }
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

function orthonormal(nx: number, ny: number, nz: number): [number, number, number] {
  if (Math.abs(ny) < 0.999) {
    const len = Math.hypot(nz, 0, -nx) || 1;
    return [nz / len, 0, -nx / len];
  }
  return [1, 0, 0];
}

function latheCap(dst: number[], idx: number[], y0: number, y1: number, material: number, brass = false) {
  const h = y1 - y0;
  const R = CAP_RADIUS;
  const profile: Array<[number, number]> = brass
    ? [
        [y0, R * 0.9],
        [y0 + h * 0.22, R * 0.97],
        [y0 + h * 0.5, R],
        [y0 + h * 0.78, R * 0.97],
        [y1, R * 0.9],
      ]
    : [
        [y0, R],
        [y0 + h * 0.12, R],
        [y0 + h * 0.5, R * 0.98],
        [y0 + h * 0.88, R * 0.96],
        [y1, R * 0.95],
      ];
  latheSolid(dst, idx, profile, 48, material);
}

function latheSolid(
  dst: number[],
  idx: number[],
  profile: Array<[number, number]>,
  segs: number,
  material: number,
) {
  const ny = profile.length;
  const base = dst.length / STRIDE;
  for (let iy = 0; iy < ny; iy++) {
    const [y, r] = profile[iy]!;
    const prev = profile[Math.max(0, iy - 1)]!;
    const next = profile[Math.min(ny - 1, iy + 1)]!;
    const dy = next[0] - prev[0];
    const dr = next[1] - prev[1];
    const plen = Math.hypot(dy, dr) || 1;
    const nr = dy / plen;
    const nyN = -dr / plen;
    for (let it = 0; it <= segs; it++) {
      const theta = (it / segs) * Math.PI * 2;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      pushVert(dst, r * c, y, r * s, nr * c, nyN, nr * s, it / segs, iy / (ny - 1), material);
    }
  }
  const stride = segs + 1;
  for (let iy = 0; iy < ny - 1; iy++) {
    for (let it = 0; it < segs; it++) {
      const a = base + iy * stride + it;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  addDisk(dst, idx, profile[0]![0], profile[0]![1], -1, segs, material);
  addDisk(dst, idx, profile[ny - 1]![0], profile[ny - 1]![1], 1, segs, material);
}

function addDisk(
  dst: number[],
  idx: number[],
  y: number,
  radius: number,
  ny: number,
  segs: number,
  material: number,
) {
  const center = dst.length / STRIDE;
  pushVert(dst, 0, y, 0, 0, ny, 0, 0.5, 0.5, material);
  for (let it = 0; it <= segs; it++) {
    const theta = (it / segs) * Math.PI * 2;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    pushVert(dst, radius * c, y, radius * s, 0, ny, 0, c * 0.5 + 0.5, s * 0.5 + 0.5, material);
  }
  for (let it = 0; it < segs; it++) {
    if (ny > 0) idx.push(center, center + 1 + it, center + 2 + it);
    else idx.push(center, center + 2 + it, center + 1 + it);
  }
}

function addDiskAt(
  dst: number[],
  idx: number[],
  x: number,
  y: number,
  z: number,
  radius: number,
  ny: number,
  segs: number,
  material: number,
) {
  const center = dst.length / STRIDE;
  pushVert(dst, x, y, z, 0, ny, 0, 0.5, 0.5, material);
  for (let it = 0; it <= segs; it++) {
    const theta = (it / segs) * Math.PI * 2;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    pushVert(dst, x + radius * c, y, z + radius * s, 0, ny, 0, c * 0.5 + 0.5, s * 0.5 + 0.5, material);
  }
  for (let it = 0; it < segs; it++) {
    if (ny > 0) idx.push(center, center + 1 + it, center + 2 + it);
    else idx.push(center, center + 2 + it, center + 1 + it);
  }
}

function addCylinder(
  dst: number[],
  idx: number[],
  x: number,
  z: number,
  y0: number,
  y1: number,
  radius: number,
  segs: number,
  material: number,
) {
  const base = dst.length / STRIDE;
  const ny = 2;
  for (let iy = 0; iy < ny; iy++) {
    const y = iy === 0 ? y0 : y1;
    for (let it = 0; it <= segs; it++) {
      const theta = (it / segs) * Math.PI * 2;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      pushVert(dst, x + radius * c, y, z + radius * s, c, 0, s, it / segs, iy, material);
    }
  }
  const stride = segs + 1;
  for (let it = 0; it < segs; it++) {
    const a = base + it;
    const b = a + 1;
    const c = a + stride;
    const d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  addDiskAt(dst, idx, x, y0, z, radius, -1, segs, material);
  addDiskAt(dst, idx, x, y1, z, radius, 1, segs, material);
}

function finish(dst: number[], idx: number[]): Mesh {
  return {
    vertices: new Float32Array(dst),
    indices: new Uint32Array(idx),
  };
}

export function createChessboard(): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];
  const half = BOARD * 0.5;
  const sqH = SQUARE_THICK;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const light = (row + col) % 2 === 0;
      const x0 = -half + col * SQUARE;
      const z0 = -half + row * SQUARE;
      const pad = INLAY * 0.5;
      addBox(
        dst,
        idx,
        x0 + SQUARE * 0.5,
        -sqH * 0.5,
        z0 + SQUARE * 0.5,
        SQUARE - pad * 2,
        sqH,
        SQUARE - pad * 2,
        light ? MAT_MAPLE : MAT_WALNUT,
        1,
      );
    }
  }
  addBox(dst, idx, 0, -sqH - 0.04, 0, BOARD + INLAY, 0.08, BOARD + INLAY, MAT_INLAY, 2);
  addBox(
    dst,
    idx,
    0,
    -sqH - 0.08 - BOARD_THICK * 0.5,
    0,
    BOARD + FRAME_WIDTH * 0.5,
    BOARD_THICK,
    BOARD + FRAME_WIDTH * 0.5,
    MAT_FRAME,
    2,
  );
  const outer = BOARD + FRAME_WIDTH * 2;
  const inner = BOARD + INLAY;
  const frameTop = FRAME_HEIGHT;
  const frameBot = -sqH - BOARD_THICK - 0.06;
  const frameH = frameTop - frameBot;
  const frameY = (frameTop + frameBot) * 0.5;
  const t = (outer - inner) * 0.5;
  addBox(dst, idx, 0, frameY, -(inner + t) * 0.5, outer, frameH, t, MAT_FRAME, 3);
  addBox(dst, idx, 0, frameY, (inner + t) * 0.5, outer, frameH, t, MAT_FRAME, 3);
  addBox(dst, idx, -(inner + t) * 0.5, frameY, 0, t, frameH, inner, MAT_FRAME, 3);
  addBox(dst, idx, (inner + t) * 0.5, frameY, 0, t, frameH, inner, MAT_FRAME, 3);
  const lip = 0.12;
  const lipY = frameTop + lip * 0.45;
  addBox(dst, idx, 0, lipY, -(inner + t) * 0.5, outer + 0.08, lip, t + 0.08, MAT_FRAME, 2);
  addBox(dst, idx, 0, lipY, (inner + t) * 0.5, outer + 0.08, lip, t + 0.08, MAT_FRAME, 2);
  addBox(dst, idx, -(inner + t) * 0.5, lipY, 0, t + 0.08, lip, inner, MAT_FRAME, 2);
  addBox(dst, idx, (inner + t) * 0.5, lipY, 0, t + 0.08, lip, inner, MAT_FRAME, 2);
  return finish(dst, idx);
}

export function createTable(): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];
  const tableTop = -SQUARE_THICK - BOARD_THICK - 0.1;
  const topH = 1.15;
  addBox(dst, idx, 0, tableTop - topH * 0.5, 0, TABLE_SIZE, topH, TABLE_SIZE, MAT_TABLE, 8);
  addBox(dst, idx, 0, tableTop - topH - 7.5, 0, TABLE_SIZE * 0.92, 0.7, TABLE_SIZE * 0.92, MAT_TABLE, 6);
  for (const [x, z] of [
    [-34, -34],
    [34, -34],
    [-34, 34],
    [34, 34],
  ] as const) {
    addBox(dst, idx, x, tableTop - 16, z, 4.2, 26, 4.2, MAT_TABLE, 4);
  }
  return finish(dst, idx);
}

export function createRoom(): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];
  const w = 140;
  const d = 120;
  const h = 62;
  const cy = h * 0.5 - 6;
  addBox(dst, idx, 0, cy, -d * 0.5, w, h, 1.2, MAT_SHELF, 4);
  addBox(dst, idx, 0, cy, d * 0.5, w, h, 1.2, MAT_WALL, 2);
  addBox(dst, idx, -w * 0.5, cy, 0, 1.2, h, d, MAT_WALL, 2);
  addBox(dst, idx, w * 0.5, cy, 0, 1.2, h, d, MAT_WALL, 2);
  addBox(dst, idx, 0, h - 6, 0, w, 1.4, d, MAT_CEILING, 2);
  addBox(dst, idx, -w * 0.5 + 0.8, 28, -8, 0.4, 22, 28, MAT_WINDOW, 1);
  addBox(dst, idx, -w * 0.5 + 1.1, 28, -8, 1.2, 24, 2.2, MAT_BRASS, 1);
  addBox(dst, idx, -w * 0.5 + 1.1, 28, -8, 1.2, 2.2, 30, MAT_BRASS, 1);
  for (let i = 0; i < 18; i++) {
    const bx = -28 + (i % 9) * 7.2;
    const by = 8 + Math.floor(i / 9) * 14;
    const bz = -d * 0.5 + 3.2;
    addBox(dst, idx, bx, by, bz, 5.4, 11 + (i % 3) * 1.4, 3.6, MAT_SHELF, 1);
  }
  return finish(dst, idx);
}

function maxGlassOuter(): number {
  let m = 0;
  for (let i = 0; i <= 80; i++) {
    const y = CAP_BOT_TOP + (CAP_TOP_BOT - CAP_BOT_TOP) * (i / 80);
    for (let k = 0; k < 24; k++) {
      m = Math.max(m, outerRadius(y, (k / 24) * Math.PI * 2, 1));
    }
  }
  return m;
}

export function createHardware(): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];
  latheCap(dst, idx, HOURGLASS_BOT, CAP_BOT_TOP, MAT_CAP_WOOD);
  latheCap(dst, idx, CAP_TOP_BOT, HOURGLASS_TOP, MAT_CAP_WOOD);
  addCylinder(dst, idx, 0, 0, HOURGLASS_BOT, HOURGLASS_BOT + 0.28, CAP_RADIUS, 48, MAT_CAP_WOOD);
  addCylinder(dst, idx, 0, 0, HOURGLASS_TOP - 0.36, HOURGLASS_TOP, CAP_RADIUS, 48, MAT_CAP_WOOD);
  addDiskAt(dst, idx, 0, CAP_BOT_TOP - 0.02, 0, CAP_RADIUS * 0.95, 1, 48, MAT_CAP_WOOD);
  addDiskAt(dst, idx, 0, CAP_TOP_BOT + 0.02, 0, CAP_RADIUS * 0.95, -1, 48, MAT_CAP_WOOD);
  addCylinder(dst, idx, 0, 0, HOURGLASS_BOT + 0.16, HOURGLASS_BOT + 0.32, CAP_RADIUS * 0.72, 40, MAT_BRASS);
  addCylinder(dst, idx, 0, 0, HOURGLASS_TOP - 0.32, HOURGLASS_TOP - 0.16, CAP_RADIUS * 0.72, 40, MAT_BRASS);

  const pr = maxGlassOuter() + PILLAR_R + 0.45;
  const socket = 0.38;
  const pillarBot = CAP_BOT_TOP - socket;
  const pillarTop = CAP_TOP_BOT + socket;
  for (const [x, z] of [
    [pr, 0],
    [-pr, 0],
    [0, pr],
    [0, -pr],
  ] as const) {
    addCylinder(dst, idx, x, z, pillarBot, pillarTop, PILLAR_R, 18, MAT_CAP_WOOD);
    addCylinder(dst, idx, x, z, CAP_BOT_TOP - 0.1, CAP_BOT_TOP + 0.18, PILLAR_R * 1.5, 14, MAT_BRASS);
    addCylinder(dst, idx, x, z, CAP_TOP_BOT - 0.18, CAP_TOP_BOT + 0.1, PILLAR_R * 1.5, 14, MAT_BRASS);
  }
  addBox(dst, idx, 0, HOURGLASS_BOT + 0.55, CAP_RADIUS * 0.82, 1.5, 0.42, 0.08, MAT_BRASS, 1);
  addBox(dst, idx, 0, HOURGLASS_TOP - 0.55, -CAP_RADIUS * 0.82, 1.5, 0.42, 0.08, MAT_BRASS, 1);
  return finish(dst, idx);
}

export function createGlass(thicknessScale = 1): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];
  const ny = 144;
  const nt = 80;
  const stride = nt + 1;

  const pushShell = (
    radiusAt: (y: number, theta: number) => number,
    derivAt: (y: number, theta: number) => number,
    flipNormal: boolean,
  ): number => {
    const base = dst.length / STRIDE;
    for (let iy = 0; iy <= ny; iy++) {
      const y = glassRingY(iy, ny);
      for (let it = 0; it <= nt; it++) {
        const theta = (it / nt) * Math.PI * 2;
        const r = radiusAt(y, theta);
        const t = thickness(y, theta, thicknessScale);
        const drdy = derivAt(y, theta);
        const nlen = Math.hypot(1, -drdy) || 1;
        const nxr = (flipNormal ? -1 : 1) / nlen;
        const nyn = (flipNormal ? 1 : -1) * (drdy / nlen);
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        pushVert(dst, r * c, y, r * s, nxr * c, nyn, nxr * s, it / nt, iy / ny, t);
      }
    }
    return base;
  };

  const stitch = (base: number, reverse: boolean) => {
    for (let iy = 0; iy < ny; iy++) {
      for (let it = 0; it < nt; it++) {
        const a = base + iy * stride + it;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        if (reverse) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    }
  };

  const outerBase = pushShell(
    (y, theta) => outerRadius(y, theta, thicknessScale),
    (y, theta) => outerRadiusDeriv(y, theta, thicknessScale),
    false,
  );
  stitch(outerBase, false);

  return finish(dst, idx);
}

export function createPileTemplate(): Mesh {
  const rings = PILE_RINGS;
  const segs = PILE_SEGS;
  const stride = segs + 1;
  const verts: Float32Array<ArrayBuffer> = new Float32Array((rings + 1) * stride * STRIDE);
  const indices: Uint32Array<ArrayBuffer> = new Uint32Array(rings * segs * 6);
  let o = 0;
  for (let j = 0; j <= rings; j++) {
    for (let i = 0; i <= segs; i++) {
      const base = (j * stride + i) * STRIDE;
      verts[base] = 0;
      verts[base + 1] = -50;
      verts[base + 2] = 0;
      verts[base + 3] = 1;
      verts[base + 4] = 0;
      verts[base + 5] = 0;
      verts[base + 6] = i / segs;
      verts[base + 7] = j / rings;
      verts[base + 8] = MAT_SAND;
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices[o++] = a;
      indices[o++] = c;
      indices[o++] = b;
      indices[o++] = b;
      indices[o++] = c;
      indices[o++] = d;
    }
  }
  return { vertices: verts, indices };
}

export function icosphere(radius: number, subdivisions = 1): Mesh {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: Array<[number, number, number]> = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ];
  const norm = (p: [number, number, number]): [number, number, number] => {
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    return [p[0] / l, p[1] / l, p[2] / l];
  };
  let verts = raw.map(norm);
  let faces: Array<[number, number, number]> = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  const midCache = new Map<string, number>();
  const midpoint = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const hit = midCache.get(key);
    if (hit !== undefined) return hit;
    const pa = verts[a]!;
    const pb = verts[b]!;
    const i = verts.length;
    verts.push(norm([(pa[0] + pb[0]) * 0.5, (pa[1] + pb[1]) * 0.5, (pa[2] + pb[2]) * 0.5]));
    midCache.set(key, i);
    return i;
  };
  for (let s = 0; s < subdivisions; s++) {
    const next: Array<[number, number, number]> = [];
    midCache.clear();
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  const dst: number[] = [];
  const idx: number[] = [];
  for (const p of verts) {
    pushVert(dst, p[0] * radius, p[1] * radius, p[2] * radius, p[0], p[1], p[2], 0, 0, 0);
  }
  for (const f of faces) idx.push(f[0], f[1], f[2]);
  return finish(dst, idx);
}
