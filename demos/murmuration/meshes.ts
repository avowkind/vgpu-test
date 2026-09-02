export const STRIDE = 7;

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
  wing: number,
): void {
  const len = Math.hypot(nx, ny, nz) || 1;
  dst.push(px, py, pz, nx / len, ny / len, nz / len, wing);
}

function freeze(dst: number[], idx: number[]): Mesh {
  return {
    vertices: new Float32Array(dst),
    indices: new Uint32Array(idx),
  };
}

/** Swallow chevron: +Z forward, +Y up. `wing` 0 = body, 1 = left, 2 = right. */
export function createBird(): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];

  const beak: [number, number, number] = [0, 0.012, 0.2];
  const back: [number, number, number] = [0, 0.038, 0.02];
  const belly: [number, number, number] = [0, -0.022, 0.03];
  const tail: [number, number, number] = [0, 0.008, -0.14];
  const leftFork: [number, number, number] = [-0.055, 0.004, -0.2];
  const rightFork: [number, number, number] = [0.055, 0.004, -0.2];
  const leftTip: [number, number, number] = [-0.34, 0.01, -0.02];
  const rightTip: [number, number, number] = [0.34, 0.01, -0.02];
  const leftTrail: [number, number, number] = [-0.14, -0.004, -0.1];
  const rightTrail: [number, number, number] = [0.14, -0.004, -0.1];

  const tri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    wing: number,
  ) => {
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abz = b[2] - a[2];
    const acx = c[0] - a[0];
    const acy = c[1] - a[1];
    const acz = c[2] - a[2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const base = dst.length / STRIDE;
    pushVert(dst, a[0], a[1], a[2], nx, ny, nz, wing);
    pushVert(dst, b[0], b[1], b[2], nx, ny, nz, wing);
    pushVert(dst, c[0], c[1], c[2], nx, ny, nz, wing);
    idx.push(base, base + 1, base + 2);
  };

  tri(beak, leftTip, leftTrail, 1);
  tri(leftTip, tail, leftTrail, 1);
  tri(beak, rightTrail, rightTip, 2);
  tri(rightTip, rightTrail, tail, 2);
  tri(beak, back, tail, 0);
  tri(beak, tail, belly, 0);
  tri(tail, leftFork, rightFork, 0);
  tri(back, leftFork, tail, 0);
  tri(back, tail, rightFork, 0);

  return freeze(dst, idx);
}

export function createGround(radius = 42, segs = 48): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];
  const y = 0;
  pushVert(dst, 0, y, 0, 0, 1, 0, 0);
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pushVert(dst, Math.cos(a) * radius, y, Math.sin(a) * radius, 0, 1, 0, 0);
  }
  for (let i = 0; i < segs; i++) {
    idx.push(0, i + 1, i + 2);
  }
  return freeze(dst, idx);
}

export function createSkyCube(size = 90): Mesh {
  const dst: number[] = [];
  const idx: number[] = [];
  const h = size * 0.5;
  const faces: Array<[number, number, number, number, number, number, number, number]> = [
    [0, 0, 1, 0, 0, h, h, h],
    [0, 0, -1, 0, 0, -h, h, h],
    [1, 0, 0, h, 0, 0, h, h],
    [-1, 0, 0, -h, 0, 0, h, h],
    [0, 1, 0, 0, h, 0, h, h],
    [0, -1, 0, 0, -h, 0, h, h],
  ];
  for (const [nx, ny, nz, ox, oy, oz, au, av] of faces) {
    const tangent =
      Math.abs(ny) < 0.999
        ? ([nz, 0, -nx] as const)
        : ([0, nz, -ny] as const);
    const tLen = Math.hypot(tangent[0], tangent[1], tangent[2]) || 1;
    const tx = tangent[0] / tLen;
    const ty = tangent[1] / tLen;
    const tz = tangent[2] / tLen;
    const bx = ny * tz - nz * ty;
    const by = nz * tx - nx * tz;
    const bz = nx * ty - ny * tx;
    const base = dst.length / STRIDE;
    const corners = [
      [-au, -av],
      [au, -av],
      [au, av],
      [-au, av],
    ];
    for (const [su, sv] of corners) {
      pushVert(
        dst,
        ox + tx * su + bx * sv,
        oy + ty * su + by * sv,
        oz + tz * su + bz * sv,
        nx,
        ny,
        nz,
        0,
      );
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return freeze(dst, idx);
}
