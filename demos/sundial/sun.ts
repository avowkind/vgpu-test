export type SunState = {
  readonly declination: number;
  readonly eotMinutes: number;
  readonly lastHours: number;
  readonly hourAngle: number;
  readonly altitude: number;
  readonly azimuth: number;
  readonly direction: readonly [number, number, number];
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  readonly aboveHorizon: boolean;
};

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function sunAt(date: Date, latDeg: number, lonDeg: number): SunState {
  const lat = latDeg * DEG;
  const jd = date.getTime() / 86_400_000 + 2_440_587.5;
  const t = (jd - 2_451_545.0) / 36_525;

  const l0 = wrapDeg(280.46646 + 36_000.76983 * t + 0.0003032 * t * t);
  const m = wrapDeg(357.52911 + 35_999.05029 * t - 0.0001537 * t * t);
  const mr = m * DEG;
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mr) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * mr) +
    0.000289 * Math.sin(3 * mr);
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const lambda = (trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG)) * DEG;
  const epsilon = (23.439291 - 0.0130042 * t + 0.00256 * Math.cos(omega * DEG)) * DEG;
  const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

  const y = Math.tan(epsilon / 2) ** 2;
  const l0r = l0 * DEG;
  const eotMinutes =
    4 *
    RAD *
    (y * Math.sin(2 * l0r) -
      2 * 0.016708617 * Math.sin(mr) +
      4 * 0.016708617 * y * Math.sin(mr) * Math.cos(2 * l0r) -
      0.5 * y * y * Math.sin(4 * l0r) -
      1.25 * 0.016708617 * 0.016708617 * Math.sin(2 * mr));

  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3_600_000;
  const lastHours = wrapHours(utcHours + lonDeg / 15 + eotMinutes / 60);
  const hourAngle = (lastHours - 12) * 15 * DEG;

  const sinAlt =
    Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  const altitude = Math.asin(clamp(sinAlt, -1, 1));
  const cosAlt = Math.cos(altitude);
  let sinA = 0;
  let cosA = 1;
  if (Math.abs(cosAlt) > 1e-6 && Math.abs(Math.cos(lat)) > 1e-6) {
    sinA = (-Math.cos(declination) * Math.sin(hourAngle)) / cosAlt;
    cosA = (Math.sin(declination) - Math.sin(altitude) * Math.sin(lat)) / (cosAlt * Math.cos(lat));
  }
  const azimuth = Math.atan2(sinA, cosA);

  const direction: [number, number, number] = [
    Math.cos(altitude) * Math.sin(azimuth),
    Math.sin(altitude),
    Math.cos(altitude) * Math.cos(azimuth),
  ];

  const aboveHorizon = altitude > 0;
  const rise = smoothstep(0, 0.09, altitude);
  const gold = smoothstep(0.02, 0.35, altitude);
  const color: [number, number, number] = [
    mix(1.0, 1.0, gold),
    mix(0.42, 0.94, gold),
    mix(0.18, 0.82, gold),
  ];

  return {
    declination,
    eotMinutes,
    lastHours,
    hourAngle,
    altitude,
    azimuth,
    direction,
    color,
    intensity: rise * mix(1.4, 2.6, gold),
    aboveHorizon,
  };
}

export function formatSolarTime(lastHours: number): string {
  const wrapped = wrapHours(lastHours);
  const h = Math.floor(wrapped);
  const m = Math.floor((wrapped - h) * 60);
  const s = Math.floor(((wrapped - h) * 60 - m) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function wrapDeg(value: number): number {
  return ((value % 360) + 360) % 360;
}

function wrapHours(value: number): number {
  return ((value % 24) + 24) % 24;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
