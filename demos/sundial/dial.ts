import {
  addGrooveQuad,
  addIcosphere,
  addLathePlate,
  freezeMesh,
  MAT_BRONZE,
  MAT_GROOVE,
  MAT_NODUS,
  MAT_PLATE,
  PLATE_RADIUS,
  PLATE_THICK,
  STRIDE,
  type Mesh,
} from "./meshes";

const OBLIQUITY = (23.44 * Math.PI) / 180;
const GROOVE_Y = 0.0012;

export type DialLayout = {
  readonly mesh: Mesh;
  readonly phi: number;
  readonly poleDirZ: number;
  readonly root: readonly [number, number, number];
  readonly nodus: readonly [number, number, number];
  readonly styleAngle: number;
};

export function createDial(phi: number, plateRadius = PLATE_RADIUS): DialLayout {
  const dst: number[] = [];
  const idx: number[] = [];
  addLathePlate(dst, idx, plateRadius, PLATE_THICK, 72, MAT_PLATE);

  const absPhi = Math.abs(phi);
  const poleDirZ = phi >= 0 ? 1 : -1;
  const equatorial = absPhi < (2 * Math.PI) / 180;
  const rootZ = equatorial ? 0 : -poleDirZ * plateRadius * 0.16;
  const root: [number, number, number] = [0, 0, rootZ];
  const baseLen = plateRadius * 0.62;
  const height = equatorial ? plateRadius * 0.55 : baseLen * Math.tan(absPhi);
  const tip: [number, number, number] = equatorial
    ? [0, height, rootZ]
    : [0, height, rootZ + poleDirZ * baseLen];
  const nodusT = 0.34;
  const nodus: [number, number, number] = [
    root[0] + (tip[0] - root[0]) * nodusT,
    root[1] + (tip[1] - root[1]) * nodusT,
    root[2] + (tip[2] - root[2]) * nodusT,
  ];

  const half = 0.007;
  addGnomonFin(dst, idx, root, tip, half);
  addIcosphere(dst, idx, nodus[0], nodus[1], nodus[2], 0.012, MAT_NODUS, 1);

  addCross(dst, idx, 0, 0, plateRadius * 0.04);
  const northZ = plateRadius * 0.9;
  addGrooveQuad(dst, idx, 0, plateRadius * 0.08, 0, northZ, 0.006, GROOVE_Y, MAT_GROOVE);
  addGrooveQuad(dst, idx, -0.018, northZ - 0.03, 0.018, northZ - 0.03, 0.005, GROOVE_Y, MAT_GROOVE);

  if (!equatorial) {
    for (let hour = 4; hour <= 20; hour++) {
      const H = ((hour - 12) * 15 * Math.PI) / 180;
      const [dx, dz] = hourLineDir(phi, H);
      const hit = clipRayToDisk(root[0], root[2], dx, dz, plateRadius * 0.96);
      if (!hit) continue;
      const width = hour === 12 ? 0.0075 : hour % 3 === 0 ? 0.0055 : 0.0036;
      addGrooveQuad(dst, idx, root[0], root[2], hit[0], hit[1], width, GROOVE_Y, MAT_GROOVE);
      if (hour !== 12) {
        const hm = ((hour - 12) * 15 + 7.5) * (Math.PI / 180);
        const [mx, mz] = hourLineDir(phi, hm);
        const mHit = clipRayToDisk(root[0], root[2], mx, mz, plateRadius * 0.78);
        if (mHit) {
          const inner = projectOnRay(root[0], root[2], mx, mz, plateRadius * 0.7);
          addGrooveQuad(dst, idx, inner[0], inner[1], mHit[0], mHit[1], 0.0024, GROOVE_Y, MAT_GROOVE);
        }
      }
      const numeral = romanHour(hour);
      const rim = Math.hypot(hit[0], hit[1]) || 1;
      const inset = (plateRadius * 0.84) / rim;
      const nx = hit[0] * inset;
      const nz = hit[1] * inset;
      if (nx * nx + nz * nz < plateRadius * plateRadius * 0.96) {
        addRoman(dst, idx, numeral, nx, nz, poleDirZ, 0.028);
      }
    }

    addDateCurve(dst, idx, nodus, phi, OBLIQUITY, plateRadius);
    addDateCurve(dst, idx, nodus, phi, 0, plateRadius);
    addDateCurve(dst, idx, nodus, phi, -OBLIQUITY, plateRadius);
  }

  return {
    mesh: freezeMesh(dst, idx),
    phi,
    poleDirZ,
    root,
    nodus,
    styleAngle: equatorial ? Math.PI / 2 : absPhi,
  };
}

function addGnomonFin(
  dst: number[],
  idx: number[],
  root: readonly [number, number, number],
  tip: readonly [number, number, number],
  half: number,
): void {
  const heel: [number, number, number] = [0, 0, tip[2]];
  const left = -half;
  const right = half;
  const pts = [
    [left, root[1], root[2]],
    [left, tip[1], tip[2]],
    [left, heel[1], heel[2]],
    [right, root[1], root[2]],
    [right, tip[1], tip[2]],
    [right, heel[1], heel[2]],
  ] as const;
  const tris = [
    [0, 1, 2],
    [3, 5, 4],
    [0, 3, 4],
    [0, 4, 1],
    [1, 4, 5],
    [1, 5, 2],
    [2, 5, 3],
    [2, 3, 0],
  ];
  for (const [a, b, c] of tris) {
    const pa = pts[a]!;
    const pb = pts[b]!;
    const pc = pts[c]!;
    const ex = pb[0] - pa[0];
    const ey = pb[1] - pa[1];
    const ez = pb[2] - pa[2];
    const fx = pc[0] - pa[0];
    const fy = pc[1] - pa[1];
    const fz = pc[2] - pa[2];
    let nx = ey * fz - ez * fy;
    let ny = ez * fx - ex * fz;
    let nz = ex * fy - ey * fx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const start = dst.length / STRIDE;
    for (const p of [pa, pb, pc]) {
      dst.push(p[0], p[1], p[2], nx, ny, nz, p[2], p[1], MAT_BRONZE);
    }
    idx.push(start, start + 1, start + 2);
  }
}

function addCross(dst: number[], idx: number[], x: number, z: number, arm: number): void {
  addGrooveQuad(dst, idx, x - arm, z, x + arm, z, 0.004, GROOVE_Y, MAT_GROOVE);
  addGrooveQuad(dst, idx, x, z - arm, x, z + arm, 0.004, GROOVE_Y, MAT_GROOVE);
}

function hourLineDir(phi: number, hourAngle: number): [number, number] {
  const tanH = Math.tan(hourAngle);
  const theta = Number.isFinite(tanH) ? Math.atan(Math.sin(phi) * tanH) : Math.sign(hourAngle) * (Math.PI / 2);
  // Noon line runs toward the elevated celestial pole — the same half as the
  // style and its shadow. Equator-pointing noon put every numeral on the empty side.
  const noonZ = phi >= 0 ? 1 : -1;
  return [noonZ * Math.sin(theta), noonZ * Math.cos(theta)];
}

function clipRayToDisk(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  radius: number,
): [number, number] | null {
  const a = dx * dx + dz * dz;
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a < 1e-10) return null;
  const t = (-b + Math.sqrt(disc)) / (2 * a);
  if (t < 0.04) return null;
  return [ox + dx * t, oz + dz * t];
}

function projectOnRay(ox: number, oz: number, dx: number, dz: number, dist: number): [number, number] {
  const len = Math.hypot(dx, dz) || 1;
  return [ox + (dx / len) * dist, oz + (dz / len) * dist];
}

function addDateCurve(
  dst: number[],
  idx: number[],
  nodus: readonly [number, number, number],
  phi: number,
  declination: number,
  plateRadius: number,
): void {
  const pts: Array<[number, number]> = [];
  for (let deg = -80; deg <= 80; deg += 2.5) {
    const H = (deg * Math.PI) / 180;
    const hit = nodusShadow(nodus, phi, declination, H);
    if (!hit) continue;
    if (hit[0] * hit[0] + hit[1] * hit[1] > plateRadius * plateRadius * 0.9) continue;
    pts.push(hit);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    addGrooveQuad(dst, idx, a[0], a[1], b[0], b[1], 0.0028, GROOVE_Y, MAT_GROOVE);
  }
}

function nodusShadow(
  nodus: readonly [number, number, number],
  phi: number,
  declination: number,
  hourAngle: number,
): [number, number] | null {
  const sinAlt =
    Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  if (alt < 0.04) return null;
  const cosAlt = Math.cos(alt);
  const sinA = (-Math.cos(declination) * Math.sin(hourAngle)) / Math.max(cosAlt, 1e-5);
  const cosA = (Math.sin(declination) - Math.sin(alt) * Math.sin(phi)) / (Math.max(cosAlt, 1e-5) * Math.max(Math.cos(phi), 1e-5));
  const az = Math.atan2(sinA, cosA);
  const sun: [number, number, number] = [
    Math.cos(alt) * Math.sin(az),
    Math.sin(alt),
    Math.cos(alt) * Math.cos(az),
  ];
  if (sun[1] < 0.04) return null;
  const t = nodus[1] / sun[1];
  return [nodus[0] - sun[0] * t, nodus[2] - sun[2] * t];
}

function romanHour(hour: number): string {
  const map = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  return map[((hour % 12) + 12) % 12]!;
}

function addRoman(
  dst: number[],
  idx: number[],
  text: string,
  x: number,
  z: number,
  poleDirZ: number,
  scale: number,
): void {
  const upX = 0;
  const upZ = poleDirZ;
  const rightX = poleDirZ;
  const rightZ = 0;
  const width = text.length * scale * 0.72;
  let cursor = -width * 0.5;
  for (const ch of text) {
    const strokes = GLYPHS[ch] ?? [];
    for (const [x0, y0, x1, y1] of strokes) {
      const ax = x + (cursor + x0 * scale) * rightX + y0 * scale * upX;
      const az = z + (cursor + x0 * scale) * rightZ + y0 * scale * upZ;
      const bx = x + (cursor + x1 * scale) * rightX + y1 * scale * upX;
      const bz = z + (cursor + x1 * scale) * rightZ + y1 * scale * upZ;
      addGrooveQuad(dst, idx, ax, az, bx, bz, 0.0042, GROOVE_Y, MAT_GROOVE);
    }
    cursor += scale * 0.72;
  }
}

const GLYPHS: Record<string, Array<[number, number, number, number]>> = {
  I: [[0.2, -0.4, 0.2, 0.4]],
  V: [
    [0.0, 0.4, 0.22, -0.4],
    [0.44, 0.4, 0.22, -0.4],
  ],
  X: [
    [0.0, 0.4, 0.44, -0.4],
    [0.44, 0.4, 0.0, -0.4],
  ],
};

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}
