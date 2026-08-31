import { DEFAULT_PARAMS, MAT_SAND, NECK_Y, type HourglassParams } from "./constants";
import { PILE_RINGS, PILE_SEGS, STRIDE } from "./meshes";
import {
  GLASS_Y0,
  GLASS_Y1,
  innerRadius,
  maxInnerRadius,
  upperChamber,
} from "./profile";

export const GRID = 40;
export const MAX_FLYING = 48;
export const INSTANCE_STRIDE = 8;

const EXTENT = maxInnerRadius() + 0.12;
const CELL = (EXTENT * 2) / GRID;
const DRAIN_SECONDS = 60;
const VISUAL_RATE = 40;
const START_DELAY = 0.8;
const EMPTY_EPS = 0.01;
const FALL_SPEED = 14;
const START_FILL = 0.75;

type Grain = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hue: number;
  scale: number;
};

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function dimpleAt(r: number, frac: number): number {
  const funnel = frac < 0.14 ? (0.14 - frac) / 0.14 : 0;
  return (0.1 + funnel * 0.7) * Math.exp((-r * r) / (0.5 * 0.5));
}

export class SandSolver {
  readonly upper: Float32Array<ArrayBuffer> = new Float32Array(GRID * GRID);
  readonly flying: Grain[] = [];
  readonly pileUpper: Float32Array<ArrayBuffer>;
  readonly pileLower: Float32Array<ArrayBuffer>;
  readonly instances: Float32Array<ArrayBuffer>;
  instanceCount = 0;
  private emitAcc = 0;
  private age = 0;
  private hold = 0;
  private frac = 1;
  private readonly initialUpper: Float32Array<ArrayBuffer>;
  private upperFillY = GLASS_Y1 - 0.2;
  private lowerHeight = GLASS_Y0 + 0.1;

  constructor(pileVerts: number) {
    this.pileUpper = new Float32Array(pileVerts);
    this.pileLower = new Float32Array(pileVerts);
    this.instances = new Float32Array(4096 * INSTANCE_STRIDE);
    this.applyUpperFrac(1, DEFAULT_PARAMS);
    this.initialUpper = new Float32Array(this.upper);
    this.upperFillY = this.fillYForFrac(1);
  }

  cellXZ(i: number, j: number): [number, number] {
    return [-EXTENT + (i + 0.5) * CELL, -EXTENT + (j + 0.5) * CELL];
  }

  private idx(i: number, j: number): number {
    return j * GRID + i;
  }

  private hole(r: number, neck: number): boolean {
    return r < neck + CELL * 0.35;
  }

  private fillYForFrac(frac: number): number {
    const f = clamp(frac, 0, 1);
    return NECK_Y + 0.22 + (GLASS_Y1 - NECK_Y - 0.28) * START_FILL * f;
  }

  private lowerFillYForFrac(filled: number): number {
    const f = clamp(filled, 0, 1);
    return GLASS_Y0 + 0.22 + (NECK_Y - GLASS_Y0 - 0.28) * START_FILL * f;
  }

  reset() {
    this.upper.set(this.initialUpper);
    this.flying.length = 0;
    this.emitAcc = 0;
    this.age = 0;
    this.hold = 0;
    this.frac = 1;
    this.upperFillY = this.fillYForFrac(1);
    this.lowerHeight = GLASS_Y0 + 0.1;
  }

  step(dt: number, params: HourglassParams) {
    const capped = Math.min(dt, 1 / 30);
    if (capped <= 1e-8) {
      this.rebuild(params);
      return;
    }

    this.age += capped;
    const duration = DRAIN_SECONDS / Math.max(0.15, params.flowRateScale);
    const draining = this.age > START_DELAY;
    const drainT = draining ? clamp((this.age - START_DELAY) / duration, 0, 1) : 0;
    const targetFrac = 1 - drainT;
    this.frac = targetFrac;

    if (drainT >= 1 - EMPTY_EPS) {
      this.hold += capped;
      this.flying.length = 0;
      this.frac = 0;
      this.applyUpperFrac(0, params);
      this.smooth(capped, 0);
      this.rebuild(params);
      if (this.hold > 1.6) this.reset();
      return;
    }

    this.applyUpperFrac(targetFrac, params);
    if (draining) this.emitAcc += VISUAL_RATE * capped;
    while (this.emitAcc >= 1 && this.flying.length < MAX_FLYING) {
      this.emitAcc -= 1;
      this.spawnGrain(params);
    }

    const sub = 4;
    const h = capped / sub;
    for (let s = 0; s < sub; s++) this.integrate(h, params);

    this.smooth(capped, targetFrac);
    this.rebuild(params);
  }

  private applyUpperFrac(frac: number, params: HourglassParams) {
    const neck = params.neckRadius;
    const fillY = this.fillYForFrac(frac);
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const n = this.idx(i, j);
        const [x, z] = this.cellXZ(i, j);
        const r = Math.hypot(x, z);
        if (frac < EMPTY_EPS || this.hole(r, neck)) {
          this.upper[n] = 0;
          continue;
        }
        const ch = upperChamber(r);
        if (ch.maxY <= ch.minY + 0.05) {
          this.upper[n] = 0;
          continue;
        }
        const support = ch.minY;
        const ceil = ch.maxY - 0.06;
        if (fillY <= support + 0.04) {
          this.upper[n] = 0;
          continue;
        }
        this.upper[n] = clamp(fillY - dimpleAt(r, frac) - support, 0, ceil - support);
      }
    }
  }

  private spawnGrain(params: HourglassParams) {
    const neck = params.neckRadius;
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * Math.max(0.008, neck * 0.22);
    this.flying.push({
      x: Math.cos(ang) * rad,
      y: NECK_Y + 0.02,
      z: Math.sin(ang) * rad,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -FALL_SPEED,
      vz: (Math.random() - 0.5) * 0.12,
      hue: Math.random(),
      scale: 0.8 + Math.random() * 0.25,
    });
  }

  private integrate(dt: number, params: HourglassParams) {
    const radius = params.grainRadius;
    const neck = params.neckRadius;
    const tanR = Math.tan((params.reposeAngle * Math.PI) / 180);
    const pileY = this.lowerHeight + this.sandRadius(this.lowerHeight, params.neckRadius) * tanR;
    const column = neck * 0.55;
    for (let i = 0; i < this.flying.length; i++) {
      const p = this.flying[i]!;
      p.vy = -FALL_SPEED;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const r = Math.hypot(p.x, p.z);
      const coneY = pileY - r * tanR;
      if (r > column && r > 1e-8) {
        const s = column / r;
        p.x *= s;
        p.z *= s;
        p.vx *= 0.2;
        p.vz *= 0.2;
      }
      const wall = innerRadius(p.y) - radius * 1.3;
      const rr = Math.hypot(p.x, p.z);
      if (rr > wall && rr > 1e-8) {
        const s = wall / rr;
        p.x *= s;
        p.z *= s;
      }

      if (p.y < Math.max(coneY + radius, GLASS_Y0 + 0.18)) {
        this.flying.splice(i, 1);
        i -= 1;
      }
    }
  }

  private smooth(dt: number, frac: number) {
    const k = 1 - Math.exp(-dt * 6);
    this.upperFillY += (this.fillYForFrac(frac) - this.upperFillY) * k;

    const filled = 1 - frac;
    const target = filled < EMPTY_EPS
      ? GLASS_Y0 + 0.1
      : this.lowerFillYForFrac(filled);
    this.lowerHeight += (target - this.lowerHeight) * k;
  }

  private hideAll(dest: Float32Array) {
    const stride = PILE_SEGS + 1;
    for (let j = 0; j <= PILE_RINGS; j++) {
      for (let i = 0; i <= PILE_SEGS; i++) {
        const base = (j * stride + i) * STRIDE;
        dest[base] = 0;
        dest[base + 1] = -50;
        dest[base + 2] = 0;
        dest[base + 3] = 0;
        dest[base + 4] = 1;
        dest[base + 5] = 0;
        dest[base + 6] = i / PILE_SEGS;
        dest[base + 7] = j / PILE_RINGS;
        dest[base + 8] = MAT_SAND;
      }
    }
  }

  private setVert(
    dest: Float32Array,
    j: number,
    i: number,
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
  ) {
    const stride = PILE_SEGS + 1;
    const base = (j * stride + i) * STRIDE;
    dest[base] = px;
    dest[base + 1] = py;
    dest[base + 2] = pz;
    const len = Math.hypot(nx, ny, nz) || 1;
    dest[base + 3] = nx / len;
    dest[base + 4] = ny / len;
    dest[base + 5] = nz / len;
    dest[base + 6] = i / PILE_SEGS;
    dest[base + 7] = j / PILE_RINGS;
    dest[base + 8] = MAT_SAND;
  }

  private sandRadius(y: number, neck: number): number {
    return Math.max(neck * 0.55, innerRadius(y) - 0.07);
  }

  private writeUpper(dest: Float32Array, neck: number, frac: number) {
    if (frac < EMPTY_EPS) {
      this.hideAll(dest);
      return;
    }
    const fillY = this.upperFillY;
    const yBot = NECK_Y + 0.16;
    const segs = PILE_SEGS;
    const rings = PILE_RINGS;
    const layers = Math.max(1, rings >> 1);
    for (let j = 0; j <= rings; j++) {
      const layer = Math.min(layers, j >> 1);
      const t = layer / layers;
      const y = fillY * (1 - t) + yBot * t;
      const onWall = j % 2 === 1;
      const rWall = this.sandRadius(y, neck);
      const hole = t > 0.92 ? neck * 0.4 : 0.001;
      const r = onWall ? rWall : hole;
      const dip = onWall ? 0 : dimpleAt(0, frac) * (1 - t);
      const lump = onWall ? 0.035 * Math.sin(layer * 2.3) * Math.sin(y * 1.1) : 0;
      const py = Math.max(yBot, y - dip + lump);
      const drdy = (this.sandRadius(y + 0.03, neck) - this.sandRadius(y - 0.03, neck)) / 0.06;
      for (let i = 0; i <= segs; i++) {
        const theta = (i / segs) * Math.PI * 2;
        const ct = Math.cos(theta);
        const st = Math.sin(theta);
        if (onWall) {
          const nlen = Math.hypot(1, -drdy) || 1;
          this.setVert(dest, j, i, r * ct, py, r * st, ct / nlen, -drdy / nlen, st / nlen);
        } else {
          this.setVert(dest, j, i, r * ct, py, r * st, 0.02 * ct, 1, 0.02 * st);
        }
      }
    }
  }

  private writeLower(dest: Float32Array, params: HourglassParams) {
    const y0 = GLASS_Y0 + 0.1;
    const fillY = this.lowerHeight;
    const filled = 1 - this.frac;
    if (fillY < y0 + 0.35 || filled < 0.02) {
      this.hideAll(dest);
      return;
    }
    const tanR = Math.max(0.15, Math.tan((params.reposeAngle * Math.PI) / 180));
    const neck = params.neckRadius;
    const apex = Math.min(NECK_Y - 0.06, fillY + this.sandRadius(fillY, neck) * tanR);
    const yTop = Math.max(fillY, apex);
    const segs = PILE_SEGS;
    const rings = PILE_RINGS;
    const layers = Math.max(1, rings >> 1);
    for (let j = 0; j <= rings; j++) {
      const layer = Math.min(layers, j >> 1);
      const t = layer / layers;
      const y = yTop * (1 - t) + y0 * t;
      const onWall = j % 2 === 1;
      const coneR = Math.max(0.001, (apex - y) / tanR);
      const rWall = Math.min(this.sandRadius(y, neck), coneR);
      const r = onWall ? rWall : 0.001;
      const drdy = (this.sandRadius(y + 0.03, neck) - this.sandRadius(y - 0.03, neck)) / 0.06;
      for (let i = 0; i <= segs; i++) {
        const theta = (i / segs) * Math.PI * 2;
        const ct = Math.cos(theta);
        const st = Math.sin(theta);
        if (onWall) {
          const alongCone = coneR < this.sandRadius(y, neck) - 0.04;
          if (alongCone) {
            this.setVert(dest, j, i, r * ct, y, r * st, tanR * ct, 1, tanR * st);
          } else {
            const nlen = Math.hypot(1, -drdy) || 1;
            this.setVert(dest, j, i, r * ct, y, r * st, ct / nlen, -drdy / nlen, st / nlen);
          }
        } else {
          this.setVert(dest, j, i, r * ct, y, r * st, 0.02 * ct, 1, 0.02 * st);
        }
      }
    }
  }

  private rebuild(params: HourglassParams) {
    this.writeUpper(this.pileUpper, params.neckRadius, this.frac);
    this.writeLower(this.pileLower, params);

    let count = 0;
    const grit = Math.max(0.005, params.grainRadius);
    for (const g of this.flying) {
      if (count >= this.instances.length / INSTANCE_STRIDE) break;
      this.writeInstance(count, g.x, g.y, g.z, grit * 1.15 * g.scale, g.hue, g.scale);
      count += 1;
    }
    this.instanceCount = count;
  }

  private writeInstance(
    i: number,
    x: number,
    y: number,
    z: number,
    radius: number,
    hue: number,
    extra: number,
  ) {
    const o = i * INSTANCE_STRIDE;
    this.instances[o] = x;
    this.instances[o + 1] = y;
    this.instances[o + 2] = z;
    this.instances[o + 3] = radius;
    const gold = 0.78 + hue * 0.16;
    this.instances[o + 4] = gold;
    this.instances[o + 5] = 0.52 + hue * 0.12;
    this.instances[o + 6] = 0.22 + extra * 0.08;
    this.instances[o + 7] = extra;
  }
}
