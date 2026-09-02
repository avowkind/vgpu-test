import { BOID_FLOATS, FLOCK_CENTER, MAX_BOIDS } from "./constants";

function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Packed Boid: pos.xyz, alive, vel.xyz, phase. */
export function seedFlock(count = MAX_BOIDS): Float32Array<ArrayBuffer> {
  const data: Float32Array<ArrayBuffer> = new Float32Array(MAX_BOIDS * BOID_FLOATS);
  for (let i = 0; i < count; i++) {
    const a = hash(i) * Math.PI * 2;
    const b = hash(i + 17) * Math.PI * 2;
    const r = 1.4 + hash(i + 31) * 3.4;
    const y = FLOCK_CENTER[1] + (hash(i + 47) - 0.5) * 2.2;
    const px = FLOCK_CENTER[0] + Math.cos(a) * r;
    const pz = FLOCK_CENTER[2] + Math.sin(a) * r * 0.72;
    const speed = 2.8 + hash(i + 71) * 1.6;
    const tangentX = -Math.sin(a);
    const tangentZ = Math.cos(a);
    const lift = (hash(i + 89) - 0.5) * 0.35;
    const swirl = Math.sin(b) * 0.25;
    const o = i * BOID_FLOATS;
    data[o] = px;
    data[o + 1] = y;
    data[o + 2] = pz;
    data[o + 3] = 1;
    data[o + 4] = (tangentX + swirl) * speed;
    data[o + 5] = lift * speed;
    data[o + 6] = (tangentZ - swirl * 0.4) * speed;
    data[o + 7] = hash(i + 101) * Math.PI * 2;
  }
  return data;
}

export function initialDispatchArgs(count: number, workgroup: number): Uint32Array<ArrayBuffer> {
  return new Uint32Array([Math.ceil(count / workgroup), 1, 1]);
}

export function initialDrawArgs(indexCount: number, instanceCount: number): Uint32Array<ArrayBuffer> {
  return new Uint32Array([indexCount, instanceCount, 0, 0, 0]);
}
