export const STRIDE = 9;

export const MAT_PLATE = 0;
export const MAT_GROOVE = 1;
export const MAT_BRONZE = 2;
export const MAT_PEDESTAL = 3;
export const MAT_GRAVEL = 4;
export const MAT_HEDGE = 5;
export const MAT_CYPRESS = 6;
export const MAT_KERB = 7;
export const MAT_NODUS = 8;
export const MAT_SKY = 9;

export const PLATE_RADIUS = 0.52;
export const PLATE_THICK = 0.07;
export const PEDESTAL_H = 0.9;
export const COURT_RADIUS = 3.6;

export type Mesh = {
  vertices: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
};

export function pushVert(
  dst: number[],
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  u: number,
  v: number,
  material: number,
): void {
  const len = Math.hypot(nx, ny, nz) || 1;
  dst.push(px, py, pz, nx / len, ny / len, nz / len, u, v, material);
}

export function addBox(
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
): void {
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

export function addDisk(
  dst: number[],
  idx: number[],
  cy: number,
  radius: number,
  segs: number,
  material: number,
  invert = false,
): void {
  const center = dst.length / STRIDE;
  pushVert(dst, 0, cy, 0, 0, invert ? -1 : 1, 0, 0.5, 0.5, material);
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    pushVert(dst, x, cy, z, 0, invert ? -1 : 1, 0, x / radius * 0.5 + 0.5, z / radius * 0.5 + 0.5, material);
  }
  for (let i = 0; i < segs; i++) {
    if (invert) idx.push(center, center + i + 2, center + i + 1);
    else idx.push(center, center + i + 1, center + i + 2);
  }
}

export function addTube(
  dst: number[],
  idx: number[],
  y0: number,
  y1: number,
  radius: number,
  segs: number,
  material: number,
  inward = false,
): void {
  const sign = inward ? -1 : 1;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    const n0x = c0 * sign;
    const n0z = s0 * sign;
    const n1x = c1 * sign;
    const n1z = s1 * sign;
    const base = dst.length / STRIDE;
    pushVert(dst, c0 * radius, y0, s0 * radius, n0x, 0, n0z, i / segs, 0, material);
    pushVert(dst, c1 * radius, y0, s1 * radius, n1x, 0, n1z, (i + 1) / segs, 0, material);
    pushVert(dst, c1 * radius, y1, s1 * radius, n1x, 0, n1z, (i + 1) / segs, 1, material);
    pushVert(dst, c0 * radius, y1, s0 * radius, n0x, 0, n0z, i / segs, 1, material);
    if (inward) idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

export function addLathePlate(
  dst: number[],
  idx: number[],
  radius: number,
  thick: number,
  segs: number,
  material: number,
): void {
  const yTop = 0;
  const yBot = -thick;
  const bevel = 0.018;
  addDisk(dst, idx, yTop, radius - bevel, segs, material);
  addDisk(dst, idx, yBot, radius, segs, material, true);
  addTube(dst, idx, yBot, yTop - bevel, radius, segs, material);
  // bevel ring
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const outer = radius;
    const inner = radius - bevel;
    const p = [
      [Math.cos(a0) * outer, yTop - bevel, Math.sin(a0) * outer],
      [Math.cos(a1) * outer, yTop - bevel, Math.sin(a1) * outer],
      [Math.cos(a1) * inner, yTop, Math.sin(a1) * inner],
      [Math.cos(a0) * inner, yTop, Math.sin(a0) * inner],
    ] as const;
    const nx = p[0][0] + p[1][0];
    const nz = p[0][2] + p[1][2];
    const ny = bevel;
    const base = dst.length / STRIDE;
    for (const [x, y, z] of p) {
      pushVert(dst, x, y, z, nx, ny, nz, x, z, material);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

export function addIcosphere(
  dst: number[],
  idx: number[],
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  material: number,
  subdiv = 1,
): void {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: Array<[number, number, number]> = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const norm = (p: [number, number, number]): [number, number, number] => {
    const len = Math.hypot(p[0], p[1], p[2]) || 1;
    return [p[0] / len, p[1] / len, p[2] / len];
  };
  let verts = raw.map(norm);
  let faces: Array<[number, number, number]> = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const midCache = new Map<string, number>();
  const midpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const hit = midCache.get(key);
    if (hit !== undefined) return hit;
    const p = norm([
      (verts[a]![0] + verts[b]![0]) * 0.5,
      (verts[a]![1] + verts[b]![1]) * 0.5,
      (verts[a]![2] + verts[b]![2]) * 0.5,
    ]);
    const id = verts.length;
    verts.push(p);
    midCache.set(key, id);
    return id;
  };
  for (let s = 0; s < subdiv; s++) {
    const next: Array<[number, number, number]> = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
    midCache.clear();
  }
  const base = dst.length / STRIDE;
  for (const p of verts) {
    pushVert(
      dst,
      cx + p[0] * radius,
      cy + p[1] * radius,
      cz + p[2] * radius,
      p[0],
      p[1],
      p[2],
      p[0] * 0.5 + 0.5,
      p[1] * 0.5 + 0.5,
      material,
    );
  }
  for (const [a, b, c] of faces) idx.push(base + a, base + b, base + c);
}

export function addCone(
  dst: number[],
  idx: number[],
  cx: number,
  y0: number,
  cz: number,
  radius: number,
  height: number,
  segs: number,
  material: number,
): void {
  const tip = dst.length / STRIDE;
  pushVert(dst, cx, y0 + height, cz, 0, 1, 0, 0.5, 1, material);
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a);
    const z = Math.sin(a);
    const px = cx + x * radius;
    const pz = cz + z * radius;
    const ny = radius / Math.max(height, 1e-4);
    pushVert(dst, px, y0, pz, x, ny, z, i / segs, 0, material);
  }
  for (let i = 0; i < segs; i++) idx.push(tip, tip + i + 1, tip + i + 2);
  addDiskAt(dst, idx, cx, y0, cz, radius, segs, material, true);
}

function addDiskAt(
  dst: number[],
  idx: number[],
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  segs: number,
  material: number,
  invert: boolean,
): void {
  const center = dst.length / STRIDE;
  pushVert(dst, cx, cy, cz, 0, invert ? -1 : 1, 0, 0.5, 0.5, material);
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const z = cz + Math.sin(a) * radius;
    pushVert(dst, x, cy, z, 0, invert ? -1 : 1, 0, Math.cos(a) * 0.5 + 0.5, Math.sin(a) * 0.5 + 0.5, material);
  }
  for (let i = 0; i < segs; i++) {
    if (invert) idx.push(center, center + i + 2, center + i + 1);
    else idx.push(center, center + i + 1, center + i + 2);
  }
}

export function addGrooveQuad(
  dst: number[],
  idx: number[],
  ax: number,
  az: number,
  bx: number,
  bz: number,
  width: number,
  y: number,
  material: number,
): void {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const px = (-dz / len) * width * 0.5;
  const pz = (dx / len) * width * 0.5;
  const base = dst.length / STRIDE;
  pushVert(dst, ax - px, y, az - pz, 0, 1, 0, 0, 0, material);
  pushVert(dst, ax + px, y, az + pz, 0, 1, 0, 1, 0, material);
  pushVert(dst, bx + px, y, bz + pz, 0, 1, 0, 1, 1, material);
  pushVert(dst, bx - px, y, bz - pz, 0, 1, 0, 0, 1, material);
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export function addSkyCube(size = 80): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];
  addBox(dst, idx, 0, 0, 0, size, size, size, MAT_SKY, 1);
  return freezeMesh(dst, idx);
}

export function createCourt(): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];
  addDisk(dst, idx, -PEDESTAL_H - 0.02, 28, 48, MAT_GRAVEL);
  addDisk(dst, idx, -PEDESTAL_H, COURT_RADIUS, 72, MAT_GRAVEL);
  addTube(dst, idx, -PEDESTAL_H, -PEDESTAL_H + 0.22, COURT_RADIUS, 64, MAT_KERB);
  addTube(dst, idx, -PEDESTAL_H, -PEDESTAL_H + 0.22, COURT_RADIUS - 0.14, 64, MAT_KERB, true);
  addDisk(dst, idx, -PEDESTAL_H + 0.22, COURT_RADIUS, 64, MAT_KERB);
  addDisk(dst, idx, -PEDESTAL_H + 0.22, COURT_RADIUS - 0.14, 64, MAT_KERB, true);

  const hedgeR = COURT_RADIUS - 0.45;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    const x = Math.cos(a) * hedgeR;
    const z = Math.sin(a) * hedgeR;
    addBox(dst, idx, x, -PEDESTAL_H + 0.38, z, 0.85, 0.76, 0.28, MAT_HEDGE, 2);
  }
  addCone(dst, idx, -2.4, -PEDESTAL_H, -2.7, 0.32, 2.4, 12, MAT_CYPRESS);
  addCone(dst, idx, 2.7, -PEDESTAL_H, -2.2, 0.28, 2.1, 12, MAT_CYPRESS);
  addCone(dst, idx, -2.9, -PEDESTAL_H, 2.4, 0.3, 2.25, 12, MAT_CYPRESS);

  return freezeMesh(dst, idx);
}

export function createPedestal(): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];
  addBox(dst, idx, 0, -PEDESTAL_H + 0.08, 0, 0.86, 0.16, 0.86, MAT_PEDESTAL, 1.4);
  addBox(dst, idx, 0, -PEDESTAL_H / 2, 0, 0.48, PEDESTAL_H - 0.28, 0.48, MAT_PEDESTAL, 1.1);
  addBox(dst, idx, 0, -0.1, 0, 0.72, 0.12, 0.72, MAT_PEDESTAL, 1.2);
  return freezeMesh(dst, idx);
}

export function freezeMesh(dst: number[], idx: number[]): Mesh {
  return {
    vertices: new Float32Array(dst),
    indices: new Uint32Array(idx),
  };
}

function orthonormal(nx: number, ny: number, nz: number): [number, number, number] {
  if (Math.abs(ny) < 0.999) {
    const len = Math.hypot(nz, 0, -nx) || 1;
    return [nz / len, 0, -nx / len];
  }
  const len = Math.hypot(0, nz, -ny) || 1;
  return [0, nz / len, -ny / len];
}
