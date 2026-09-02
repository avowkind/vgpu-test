import { orthographicCamera, type OrthographicCamera } from "vgpu/scene";
import { COURT_RADIUS, PEDESTAL_H } from "./meshes";

const CORNERS: Array<readonly [number, number, number]> = [
  [-COURT_RADIUS, -PEDESTAL_H, -COURT_RADIUS],
  [COURT_RADIUS, -PEDESTAL_H, -COURT_RADIUS],
  [-COURT_RADIUS, -PEDESTAL_H, COURT_RADIUS],
  [COURT_RADIUS, -PEDESTAL_H, COURT_RADIUS],
  [-1.2, 1.6, -1.2],
  [1.2, 1.6, 1.2],
  [-1.2, 0, 1.2],
  [1.2, 0, -1.2],
];

export function createLightCamera(): OrthographicCamera {
  return orthographicCamera({
    left: -4,
    right: 4,
    bottom: -4,
    top: 4,
    near: 0.5,
    far: 40,
    position: [6, 10, 6],
    target: [0, 0, 0],
  });
}

export function fitLightCamera(
  camera: OrthographicCamera,
  sunToward: readonly [number, number, number],
): void {
  const dist = 18;
  const up: [number, number, number] =
    Math.abs(sunToward[1]) > 0.92 ? [1, 0, 0] : [0, 1, 0];
  camera.set({
    position: [sunToward[0] * dist, sunToward[1] * dist, sunToward[2] * dist],
  });
  camera.lookAt([0, 0, 0], up);

  const view = camera.view;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, y, z] of CORNERS) {
    const vx = view[0]! * x + view[4]! * y + view[8]! * z + view[12]!;
    const vy = view[1]! * x + view[5]! * y + view[9]! * z + view[13]!;
    const vz = view[2]! * x + view[6]! * y + view[10]! * z + view[14]!;
    minX = Math.min(minX, vx);
    maxX = Math.max(maxX, vx);
    minY = Math.min(minY, vy);
    maxY = Math.max(maxY, vy);
    minZ = Math.min(minZ, vz);
    maxZ = Math.max(maxZ, vz);
  }

  const pad = 0.35;
  const near = Math.max(0.2, -maxZ - pad);
  const far = Math.max(near + 1, -minZ + pad);
  camera.set({
    left: minX - pad,
    right: maxX + pad,
    bottom: minY - pad,
    top: maxY + pad,
    near,
    far,
  });
}

export function invertMat4(m: ArrayLike<number>): Float32Array {
  const out = new Float32Array(16);
  const a00 = m[0]!, a01 = m[1]!, a02 = m[2]!, a03 = m[3]!;
  const a10 = m[4]!, a11 = m[5]!, a12 = m[6]!, a13 = m[7]!;
  const a20 = m[8]!, a21 = m[9]!, a22 = m[10]!, a23 = m[11]!;
  const a30 = m[12]!, a31 = m[13]!, a32 = m[14]!, a33 = m[15]!;
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-8) {
    out.set(m);
    return out;
  }
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
