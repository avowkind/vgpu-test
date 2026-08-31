import { BULB_INNER, CAP_BOT_TOP, CAP_TOP_BOT, NECK_INNER, NECK_Y } from "./constants";

export type ProfileSample = {
  readonly y: number;
  readonly innerR: number;
};

const Y0 = CAP_BOT_TOP;
const Y1 = CAP_TOP_BOT;
const HALF = (Y1 - Y0) * 0.5;

/**
 * Classic two-bulb inner profile (cm). Catmull-Rom through these (y, r) points:
 * round bulbs, a short cylindrical neck, slight cinch at the caps.
 */
const INNER: ReadonlyArray<readonly [number, number]> = [
  [Y0 - 0.2, 2.28],
  [Y0, 2.38],
  [2.4, 2.72],
  [3.55, 3.28],
  [5.15, BULB_INNER],
  [6.55, 3.08],
  [7.7, 2.15],
  [8.55, 1.12],
  [9.15, 0.64],
  [9.55, 0.49],
  [NECK_Y, NECK_INNER],
  [10.45, 0.49],
  [10.85, 0.64],
  [11.45, 1.12],
  [12.3, 2.15],
  [13.45, 3.08],
  [14.85, BULB_INNER],
  [16.45, 3.28],
  [17.6, 2.72],
  [Y1, 2.38],
  [Y1 + 0.2, 2.28],
];

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function innerRadius(y: number): number {
  const pts = INNER;
  const first = pts[1]!;
  const last = pts[pts.length - 2]!;
  if (y <= first[0]) return Math.max(NECK_INNER, first[1]);
  if (y >= last[0]) return Math.max(NECK_INNER, last[1]);
  let i = 1;
  while (i < pts.length - 2 && pts[i + 1]![0] < y) i += 1;
  const a = pts[i - 1]!;
  const b = pts[i]!;
  const c = pts[i + 1]!;
  const d = pts[i + 2]!;
  const t = (y - b[0]) / Math.max(1e-6, c[0] - b[0]);
  return Math.max(NECK_INNER * 0.95, catmullRom(a[1], b[1], c[1], d[1], t));
}

export function innerRadiusDeriv(y: number): number {
  const h = 0.03;
  return (innerRadius(y + h) - innerRadius(y - h)) / (2 * h);
}

/** Glass thickness in cm: thin at the neck, thicker at the bulbs and caps. */
export function thickness(y: number, theta: number, scale = 1): number {
  const t = (y - NECK_Y) / HALF;
  const u = Math.min(1, Math.abs(t));
  const base = 0.18 + 0.16 * u + 0.24 * u * u;
  const wave = 0.035 * Math.sin(y * 2.15 + 0.35) * Math.sin(theta * 3.0 + y * 0.4);
  const upper = t > 0 ? u : 0;
  const asym = 0.1 * upper * (0.5 + 0.5 * Math.cos(theta - 0.55));
  return Math.max(0.15, (base + wave) * (1 + asym) * scale);
}

export function outerRadius(y: number, theta: number, scale = 1): number {
  return innerRadius(y) + thickness(y, theta, scale);
}

export function outerRadiusDeriv(y: number, theta: number, scale = 1): number {
  const h = 0.03;
  return (outerRadius(y + h, theta, scale) - outerRadius(y - h, theta, scale)) / (2 * h);
}

const SAMPLES = 192;
const DY = (Y1 - Y0) / (SAMPLES - 1);

export const PROFILE: ProfileSample[] = Array.from({ length: SAMPLES }, (_, i) => {
  const y = Y0 + i * DY;
  return { y, innerR: innerRadius(y) };
});

type ChamberRange = { minY: number; maxY: number };

function chamberAtRadius(r: number, yStart: number, yEnd: number, step: number): ChamberRange {
  let minY = yEnd;
  let maxY = yStart;
  let inside = false;
  for (let y = yStart; y <= yEnd + 1e-6; y += step) {
    const ok = innerRadius(y) >= r - 1e-4;
    if (ok) {
      if (!inside) minY = y;
      maxY = y;
      inside = true;
    } else if (inside) {
      break;
    }
  }
  if (!inside) return { minY: yStart, maxY: yStart };
  return { minY, maxY };
}

const R_BINS = 80;
const R_MAX = BULB_INNER + 0.08;
const R_STEP = R_MAX / (R_BINS - 1);

const LOWER: ChamberRange[] = [];
const UPPER: ChamberRange[] = [];

for (let i = 0; i < R_BINS; i++) {
  const r = i * R_STEP;
  LOWER.push(chamberAtRadius(r, Y0, NECK_Y, 0.03));
  UPPER.push(chamberAtRadius(r, NECK_Y, Y1, 0.03));
}

function lerpRange(table: ChamberRange[], r: number): ChamberRange {
  const t = Math.max(0, Math.min(R_BINS - 1 - 1e-6, r / R_STEP));
  const i = Math.floor(t);
  const f = t - i;
  const a = table[i]!;
  const b = table[i + 1] ?? a;
  return {
    minY: a.minY * (1 - f) + b.minY * f,
    maxY: a.maxY * (1 - f) + b.maxY * f,
  };
}

export function lowerChamber(r: number): ChamberRange {
  return lerpRange(LOWER, Math.abs(r));
}

export function upperChamber(r: number): ChamberRange {
  return lerpRange(UPPER, Math.abs(r));
}

export function maxInnerRadius(): number {
  let m = 0;
  for (const s of PROFILE) m = Math.max(m, s.innerR);
  return m;
}

export const GLASS_Y0 = Y0;
export const GLASS_Y1 = Y1;

export const BUBBLES: ReadonlyArray<readonly [number, number, number, number]> = [
  [1.85, 13.4, 0.55, 0.09],
  [-2.05, 15.1, -0.8, 0.07],
  [0.35, 6.2, 2.15, 0.11],
  [-1.4, 4.6, -1.7, 0.06],
  [2.2, 16.8, 1.1, 0.05],
  [0.9, 8.7, -2.0, 0.08],
];

/** Y samples concentrated at the waist so the pinch is not tessellated away. */
export function glassRingY(i: number, rings: number): number {
  const t = i / rings;
  const u = t * 2 - 1;
  const warped = 0.5 + 0.5 * Math.sign(u) * Math.pow(Math.abs(u), 1.45);
  return Y0 + (Y1 - Y0) * warped;
}
