/** Scene units are centimetres. Playing surface is y = 0. */

export const SQUARE = 5.75;
export const BOARD = SQUARE * 8;
export const INLAY = 0.07;
export const FRAME_WIDTH = 1.35;
export const FRAME_HEIGHT = 0.42;
export const BOARD_THICK = 0.9;
export const SQUARE_THICK = 0.16;
export const TABLE_SIZE = 92;

export const HOURGLASS_BOT = 0.45;
export const CAP_BOT_TOP = 1.52;
export const CAP_TOP_BOT = 18.48;
export const HOURGLASS_TOP = 19.92;
export const NECK_Y = 10;
export const NECK_INNER = 0.45;
export const BULB_INNER = 3.18;
export const CAP_RADIUS = 5.15;
export const PILLAR_R = 0.26;
/** Unused legacy; posts are placed tangent to the glass exterior. */
export const PILLAR_OFFSET = 2.72;

export const GRAVITY = 981;
export const REPOSE_DEG = 32;
export const GRAIN_RADIUS = 0.009;

export const IDENTITY = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

export const MAT_MAPLE = 0;
export const MAT_WALNUT = 1;
export const MAT_TABLE = 2;
export const MAT_FRAME = 3;
export const MAT_BRASS = 4;
export const MAT_CAP_WOOD = 5;
export const MAT_WALL = 6;
export const MAT_SHELF = 7;
export const MAT_WINDOW = 8;
export const MAT_SAND = 9;
export const MAT_INLAY = 10;
export const MAT_CEILING = 11;

export type HourglassParams = {
  reposeAngle: number;
  neckRadius: number;
  grainRadius: number;
  flowRateScale: number;
  glassIor: number;
  thicknessScale: number;
  dispersion: number;
  absorptionDistance: number;
  cameraOrbit: number;
  sandCount: number;
};

export const DEFAULT_PARAMS: HourglassParams = {
  reposeAngle: REPOSE_DEG,
  neckRadius: NECK_INNER,
  grainRadius: GRAIN_RADIUS,
  flowRateScale: 1,
  glassIor: 1.52,
  thicknessScale: 1,
  dispersion: 1,
  absorptionDistance: 6,
  cameraOrbit: 1,
  sandCount: 2800,
};
