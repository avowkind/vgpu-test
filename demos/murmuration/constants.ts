export const MAX_BOIDS = 4096;
export const DEFAULT_FLOCK = 2048;
export const WORKGROUP = 64;
export const MAX_GROUPS = Math.ceil(MAX_BOIDS / WORKGROUP);

export const BOID_FLOATS = 8;
export const BOID_BYTES = BOID_FLOATS * 4;

export const FLOCK_CENTER: [number, number, number] = [0, 3.2, 0];
export const FLOCK_Y = FLOCK_CENTER[1];

export const DEFAULT_SEP = 1.35;
export const DEFAULT_ALIGN = 0.85;
export const DEFAULT_COH = 0.55;
export const DEFAULT_SPEED = 4.8;
