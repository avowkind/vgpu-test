/** Regular dodecahedron with flat-shaded faces tinted red / white / blue. */

const PHI = (1 + Math.sqrt(5)) / 2;

const FACE_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [0.86, 0.12, 0.16], // red
  [0.96, 0.96, 0.96], // white
  [0.12, 0.28, 0.78], // blue
];

function normalize(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function normalizeAll(points: ReadonlyArray<readonly [number, number, number]>) {
  return points.map(([x, y, z]) => normalize(x, y, z));
}

function dot(a: readonly number[], b: readonly number[]) {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

function cross(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ];
}

/** Dual of the unit icosahedron — 20 vertices, 12 pentagonal faces. */
function dodecahedronSeed() {
  const icoVertices = normalizeAll([
    [-1, PHI, 0],
    [1, PHI, 0],
    [-1, -PHI, 0],
    [1, -PHI, 0],
    [0, -1, PHI],
    [0, 1, PHI],
    [0, -1, -PHI],
    [0, 1, -PHI],
    [PHI, 0, -1],
    [PHI, 0, 1],
    [-PHI, 0, -1],
    [-PHI, 0, 1],
  ]);

  const icoFaces: ReadonlyArray<readonly [number, number, number]> = [
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

  const vertices = icoFaces.map(([a, b, c]) => {
    const va = icoVertices[a]!;
    const vb = icoVertices[b]!;
    const vc = icoVertices[c]!;
    return normalize(
      va[0] + vb[0] + vc[0],
      va[1] + vb[1] + vc[1],
      va[2] + vb[2] + vc[2],
    );
  });

  const faces = icoVertices.map((axis, vertexIndex) => {
    const adjacent = icoFaces
      .map((face, index) => (face.includes(vertexIndex) ? index : -1))
      .filter((index) => index >= 0);

    const first = vertices[adjacent[0]!]!;
    const projected = normalize(
      first[0] - axis[0] * dot(first, axis),
      first[1] - axis[1] * dot(first, axis),
      first[2] - axis[2] * dot(first, axis),
    );
    const tangent = cross(axis, projected);

    return [...adjacent].sort((left, right) => {
      const a = vertices[left]!;
      const b = vertices[right]!;
      return (
        Math.atan2(dot(a, tangent), dot(a, projected)) -
        Math.atan2(dot(b, tangent), dot(b, projected))
      );
    });
  });

  return { vertices, faces };
}

function faceNormal(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
): [number, number, number] {
  return normalize(
    (b[1]! - a[1]!) * (c[2]! - a[2]!) - (b[2]! - a[2]!) * (c[1]! - a[1]!),
    (b[2]! - a[2]!) * (c[0]! - a[0]!) - (b[0]! - a[0]!) * (c[2]! - a[2]!),
    (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!),
  );
}

export function createColoredDodecahedron(radius = 1) {
  const { vertices: corners, faces } = dodecahedronSeed();
  const interleaved: number[] = [];
  const indices: number[] = [];

  faces.forEach((face, faceIndex) => {
    const color = FACE_COLORS[faceIndex % FACE_COLORS.length]!;
    const a = corners[face[0]!]!;

    for (let i = 1; i < face.length - 1; i++) {
      let b = corners[face[i]!]!;
      let c = corners[face[i + 1]!]!;
      let normal = faceNormal(a, b, c);
      const center = [
        (a[0]! + b[0]! + c[0]!) / 3,
        (a[1]! + b[1]! + c[1]!) / 3,
        (a[2]! + b[2]! + c[2]!) / 3,
      ];

      if (dot(normal, center) < 0) {
        const swap = b;
        b = c;
        c = swap;
        normal = faceNormal(a, b, c);
      }

      const base = interleaved.length / 9;
      for (const point of [a, b, c]) {
        interleaved.push(
          point[0]! * radius,
          point[1]! * radius,
          point[2]! * radius,
          normal[0],
          normal[1],
          normal[2],
          color[0],
          color[1],
          color[2],
        );
      }
      indices.push(base, base + 1, base + 2);
    }
  });

  return {
    vertices: new Float32Array(interleaved),
    indices: new Uint16Array(indices),
  };
}
