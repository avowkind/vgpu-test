import { hash1, hash3 } from "@vgpu/wgsl-std/hash";
import { simplex3d } from "@vgpu/wgsl-std/noise/simplex";

struct Params {
  time: f32,
  aspect: f32,
  ringAngle: f32,
  ballSpin: f32,
  cameraPos: vec4f,
  cameraForward: vec4f,
  cameraRight: vec4f,
  cameraUp: vec4f,
  ballPos: vec4f,
}

@group(0) @binding(0) var<uniform> params: Params;

const MAX_STEPS: i32 = 110;
const MAX_DIST: f32 = 48.0;
const SURF_DIST: f32 = 0.001;

const RING_MAJOR: f32 = 4.3;
const RING_BAND: f32 = 0.28;
const RING_THICK: f32 = 0.09;
const BALL_RADIUS: f32 = 0.38;
const AMPLITUDE: f32 = 4.6;

fn sdSphere(p: vec3f, r: f32) -> f32 {
  return length(p) - r;
}

fn sdRingRibbon(p: vec3f, major: f32, band: f32, thick: f32) -> f32 {
  let radial = length(p.yz) - major;
  let d = vec2f(abs(radial) - band, abs(p.x) - thick);
  return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0)));
}

fn rotateX(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

fn hullRelief(p: vec3f) -> f32 {
  let ang = atan2(p.z, p.y);
  let radial = length(p.yz);
  let belts = abs(sin(ang * 28.0));
  let ribs = abs(sin((radial - RING_MAJOR) * 42.0));
  let hatches = abs(sin(ang * 7.0 + radial * 9.0));
  let panel =
    smoothstep(0.88, 1.0, belts) * 0.012 +
    smoothstep(0.9, 1.0, ribs) * 0.01 +
    smoothstep(0.94, 1.0, hatches) * 0.008;
  let micro = simplex3d(p * 9.0) * 0.004;
  return panel + micro;
}

fn mapScene(p: vec3f) -> vec2f {
  let ball = params.ballPos.xyz;
  let ringLocal = rotateX(p, -params.ringAngle);
  var ring = sdRingRibbon(ringLocal, RING_MAJOR, RING_BAND, RING_THICK);
  ring += hullRelief(ringLocal);

  let ballLocal = rotateX(p - ball, -params.ballSpin);
  let sphere = sdSphere(ballLocal, BALL_RADIUS);
  if (ring < sphere) {
    return vec2f(ring, 1.0);
  }
  return vec2f(sphere, 2.0);
}

fn calcNormal(p: vec3f) -> vec3f {
  let e = vec2f(0.0015, 0.0);
  return normalize(vec3f(
    mapScene(p + e.xyy).x - mapScene(p - e.xyy).x,
    mapScene(p + e.yxy).x - mapScene(p - e.yxy).x,
    mapScene(p + e.yyx).x - mapScene(p - e.yyx).x,
  ));
}

fn raymarch(ro: vec3f, rd: vec3f) -> vec2f {
  var t = 0.0;
  var id = 0.0;
  for (var i = 0; i < MAX_STEPS; i++) {
    let hit = mapScene(ro + rd * t);
    id = hit.y;
    if (hit.x < SURF_DIST || t > MAX_DIST) {
      break;
    }
    t += hit.x * 0.82;
  }
  if (t > MAX_DIST) {
    return vec2f(-1.0, 0.0);
  }
  return vec2f(t, id);
}

fn starField(rd: vec3f) -> vec3f {
  // Sparse pinpoints on the celestial sphere. Keep density and brightness low
  // so space stays mostly black.
  let dir = normalize(rd);
  var stars = vec3f(0.0);

  for (var layer = 0; layer < 2; layer++) {
    let scale = 95.0 + f32(layer) * 60.0;
    let base = floor(dir * scale);

    for (var z = -1; z <= 1; z++) {
      for (var y = -1; y <= 1; y++) {
        for (var x = -1; x <= 1; x++) {
          let cell = base + vec3f(f32(x), f32(y), f32(z));
          let rnd = hash3(cell + vec3f(f32(layer) * 17.0, 4.0, 11.0));
          // ~1.5% of cells get a star.
          if (rnd.x > 0.015) {
            continue;
          }
          let starDir = normalize(cell + rnd);
          let align = dot(dir, starDir);
          // Only the nearest patch on the sphere contributes — avoids soft blobs.
          if (align < 0.997) {
            continue;
          }
          let d = 1.0 - align;
          let spark = exp(-d * 900000.0);
          let tint = mix(vec3f(0.75, 0.82, 1.0), vec3f(1.0, 0.95, 0.85), rnd.y);
          stars += tint * spark * mix(0.45, 0.9, rnd.z);
        }
      }
    }
  }

  // A couple of slightly brighter beacons.
  for (var b = 0; b < 2; b++) {
    let seed = hash3(vec3f(f32(b) * 9.0 + 1.0, 3.0, 7.0));
    let beaconDir = normalize(seed * 2.0 - vec3f(1.0));
    let align = dot(dir, beaconDir);
    if (align < 0.9985) {
      continue;
    }
    let d = 1.0 - align;
    stars += vec3f(0.9, 0.95, 1.0) * exp(-d * 1200000.0) * 1.3;
  }

  return stars;
}

fn nebula(rd: vec3f) -> vec3f {
  let p = rd * 2.5;
  let n1 = simplex3d(p * 1.2);
  let n2 = simplex3d(p * 2.4 + vec3f(4.0, 1.0, 2.0));
  let mist = smoothstep(0.25, 0.8, n1 * 0.6 + n2 * 0.4);
  return vec3f(0.03, 0.045, 0.09) * mist * 0.22;
}

fn voidColor(rd: vec3f) -> vec3f {
  let v = rd.y * 0.5 + 0.5;
  return mix(vec3f(0.004, 0.005, 0.01), vec3f(0.015, 0.02, 0.04), v) + nebula(rd);
}

/** Direction to Sol from the ring — ship orbits at ~1 AU (compressed year for the demo). */
fn sunDir(t: f32) -> vec3f {
  let orbit = t * 0.028;
  let incl = 0.18;
  return normalize(vec3f(cos(orbit), sin(incl) * sin(orbit * 0.5 + 0.4), sin(orbit)));
}

fn sunColor() -> vec3f {
  // ~5800 K Sol: warm white.
  return vec3f(1.0, 0.96, 0.9);
}

fn sunDisk(rd: vec3f, toSun: vec3f) -> vec3f {
  let align = max(dot(normalize(rd), toSun), 0.0);
  // Angular diameter ~0.53° — small hard disk plus soft corona.
  let core = smoothstep(0.99996, 0.999992, align);
  let limb = smoothstep(0.99994, 0.99998, align);
  let corona = pow(align, 1200.0) * 0.55 + pow(align, 180.0) * 0.08 + pow(align, 40.0) * 0.02;
  let sol = sunColor();
  return sol * (core * 12.0 + limb * 3.5 + corona);
}

fn envColor(rd: vec3f) -> vec3f {
  let toSun = sunDir(params.time);
  return voidColor(rd) + starField(rd) + sunDisk(rd, toSun);
}

fn sunShadow(p: vec3f, toSun: vec3f) -> f32 {
  var t = 0.06;
  var shade = 1.0;
  for (var i = 0; i < 28; i++) {
    let d = mapScene(p + toSun * t).x;
    shade = min(shade, 8.0 * d / t);
    t += clamp(d, 0.025, 0.4);
    if (d < 0.0008 || t > 14.0) {
      break;
    }
  }
  return clamp(shade, 0.12, 1.0);
}

fn plasmaOn() -> bool {
  return params.ballPos.w > 0.5;
}

fn plasmaTint(t: f32) -> vec3f {
  let pulse = 0.5 + 0.5 * sin(t * 2.4);
  return mix(vec3f(1.0, 0.45, 0.12), vec3f(1.0, 0.82, 0.35), pulse * 0.55);
}

/** Soft occlusion toward the free mass (skips the ball itself). */
fn plasmaShadow(p: vec3f, toBall: vec3f, ball: vec3f) -> f32 {
  let maxT = length(ball - p) - BALL_RADIUS * 1.05;
  if (maxT < 0.04) {
    return 1.0;
  }
  let dir = normalize(toBall);
  var t = 0.04;
  var shade = 1.0;
  for (var i = 0; i < 22; i++) {
    let sample = p + dir * t;
    let ringLocal = rotateX(sample, -params.ringAngle);
    let d = sdRingRibbon(ringLocal, RING_MAJOR, RING_BAND, RING_THICK) + hullRelief(ringLocal);
    shade = min(shade, 10.0 * d / t);
    t += clamp(d, 0.02, 0.35);
    if (d < 0.0008 || t > maxT) {
      break;
    }
  }
  return clamp(shade, 0.08, 1.0);
}

fn plasmaLight(p: vec3f, n: vec3f, rd: vec3f, ball: vec3f, t: f32, base: vec3f) -> vec3f {
  if (!plasmaOn()) {
    return vec3f(0.0);
  }
  let toBall = ball - p;
  let dist = length(toBall);
  let L = toBall / max(dist, 0.001);
  let atten = 18.0 / (1.0 + dist * dist * 0.55);
  let shade = plasmaShadow(p + n * 0.01, toBall, ball);
  let diff = max(dot(n, L), 0.0);
  let h = normalize(L - rd);
  let spec = pow(max(dot(n, h), 0.0), 48.0);
  let tint = plasmaTint(t);
  // Warm fill wraps a little so the inner face still reads when grazing.
  let wrap = max(dot(n, L) * 0.5 + 0.5, 0.0);
  return base * tint * (diff * 1.35 + wrap * 0.22) * atten * shade
    + tint * spec * atten * shade * 0.85;
}

fn shipAlbedo(p: vec3f) -> vec3f {
  let ang = atan2(p.z, p.y);
  let radial = length(p.yz);
  let u = (radial - RING_MAJOR + RING_BAND) / (RING_BAND * 2.0);

  let panelA = floor(ang * 14.0);
  let panelB = floor(u * 8.0);
  let panelRnd = hash1(panelA * 13.7 + panelB * 5.3);
  let plate = mix(vec3f(0.09, 0.1, 0.12), vec3f(0.14, 0.15, 0.17), panelRnd);

  let trenchU = abs(fract(u * 8.0) - 0.5);
  let trenchV = abs(fract(ang * 14.0 / 6.2831853) - 0.5);
  let trench = smoothstep(0.04, 0.0, trenchU) + smoothstep(0.035, 0.0, trenchV);
  var col = plate * (1.0 - trench * 0.45);

  let innerFace = smoothstep(RING_MAJOR - RING_BAND * 0.2, RING_MAJOR - RING_BAND * 0.95, radial);
  let emitter = innerFace * (0.55 + 0.45 * sin(ang * 40.0));
  col = mix(col, vec3f(0.05, 0.08, 0.1), emitter * 0.65);

  let glyph = step(0.965, hash1(panelA * 2.1 + 9.0)) * step(0.4, u) * step(u, 0.75);
  col += vec3f(0.35, 0.55, 0.7) * glyph * 0.25;
  col *= 0.92 + 0.08 * simplex3d(p * 14.0);
  return col;
}

/** Spherical ship plating on the free mass — same family as the ringworld hull. */
fn ballAlbedo(local: vec3f) -> vec3f {
  let n = normalize(local);
  let lon = atan2(n.z, n.y);
  let lat = asin(clamp(n.x, -1.0, 1.0));
  let u = lon * 0.5 / 3.14159265 + 0.5;
  let v = lat / 3.14159265 + 0.5;

  let panelA = floor(u * 14.0);
  let panelB = floor(v * 10.0);
  let panelRnd = hash1(panelA * 11.3 + panelB * 7.9);
  let plate = mix(vec3f(0.11, 0.12, 0.14), vec3f(0.22, 0.23, 0.26), panelRnd);

  let trenchU = abs(fract(u * 14.0) - 0.5);
  let trenchV = abs(fract(v * 10.0) - 0.5);
  let trench = smoothstep(0.07, 0.0, trenchU) + smoothstep(0.065, 0.0, trenchV);
  var col = plate * (1.0 - trench * 0.7);

  // Equatorial service band around the core axis (X) — reads spin clearly.
  let belt = smoothstep(0.18, 0.0, abs(n.x));
  col = mix(col, vec3f(0.05, 0.1, 0.11), belt * 0.7);
  col += vec3f(0.2, 0.85, 0.75) * belt * (0.12 + 0.1 * sin(lon * 16.0));

  // Polar caps / registry tiles.
  let pole = smoothstep(0.65, 0.95, abs(n.x));
  col = mix(col, vec3f(0.18, 0.2, 0.24), pole * 0.45);

  let glyph = step(0.94, hash1(panelA * 3.1 + panelB + 4.0));
  col += vec3f(0.35, 0.6, 0.8) * glyph * 0.28;
  col *= 0.88 + 0.12 * simplex3d(local * 8.0);
  return col;
}

fn ringGlow(local: vec3f, n: vec3f, ball: vec3f, t: f32) -> vec3f {
  let radial = length(local.yz);
  let inner = smoothstep(RING_MAJOR - RING_BAND * 0.15, RING_MAJOR - RING_BAND * 0.95, radial);
  let face = smoothstep(RING_THICK * 1.1, RING_THICK * 0.15, abs(local.x));
  let pulse = 0.65 + 0.35 * sin(t * 1.4 + atan2(local.z, local.y) * 8.0);
  let nearBall = exp(-length(vec2f(local.y - ball.y, local.z - ball.z)) * 1.8) * exp(-abs(ball.x) * 0.15);
  let transitBoost = exp(-abs(ball.x) * 1.1) * 1.8;
  let glow = inner * face * pulse * (0.45 + nearBall * 1.2 + transitBoost * 0.35);
  let alien = vec3f(0.2, 0.95, 0.85);
  let hot = vec3f(0.55, 0.35, 1.0);
  let tint = mix(alien, hot, 0.35 + 0.35 * sin(t * 0.8));
  return tint * glow * (0.4 + 0.35 * max(-dot(n, normalize(vec3f(sign(local.x + 0.001), 0.0, 0.0))), 0.0));
}

fn shadeRing(p: vec3f, n: vec3f, rd: vec3f, ball: vec3f, t: f32) -> vec3f {
  let local = rotateX(p, -params.ringAngle);
  let toSun = sunDir(t);
  let sol = sunColor();
  let shadow = sunShadow(p + n * 0.012, toSun);
  let h = normalize(toSun - rd);
  let diff = max(dot(n, toSun), 0.0);
  let spec = pow(max(dot(n, h), 0.0), 64.0);
  let rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.8);

  let base = shipAlbedo(local);
  // Dim distant Sol a touch when the local plasma sun is the hero key.
  let solGain = select(1.55, 0.55, plasmaOn());
  let lit = base * (0.03 + sol * diff * shadow * solGain);
  let highlight = sol * spec * shadow * select(0.55, 0.18, plasmaOn());
  let rimLight = vec3f(0.12, 0.28, 0.45) * rim * 0.12;
  let reflectCol = voidColor(reflect(rd, n)) * 0.05 + sunDisk(reflect(rd, n), toSun) * 0.08;
  var col = lit + highlight + rimLight + reflectCol + ringGlow(local, n, ball, t);
  col += plasmaLight(p, n, rd, ball, t, base);
  return col;
}

fn shadePlasmaBall(p: vec3f, n: vec3f, rd: vec3f, ball: vec3f, t: f32) -> vec3f {
  let local = p - ball;
  let q = local * 3.2 + vec3f(t * 0.55, t * 0.4, -t * 0.35);
  let boil = simplex3d(q) * 0.55 + simplex3d(q * 2.1 + 3.1) * 0.3 + simplex3d(q * 4.4) * 0.15;
  let limb = pow(max(dot(n, -rd), 0.0), 0.55);
  let hot = mix(vec3f(1.0, 0.25, 0.05), vec3f(1.0, 0.95, 0.65), limb * 0.75 + boil * 0.35);
  let flare = pow(max(boil, 0.0), 2.2) * 2.8;
  let rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.4);
  let corona = plasmaTint(t) * rim * (1.4 + flare);
  return hot * (4.5 + flare * 3.0) + corona;
}

fn shadeBall(p: vec3f, n: vec3f, rd: vec3f, ball: vec3f, t: f32) -> vec3f {
  if (plasmaOn()) {
    return shadePlasmaBall(p, n, rd, ball, t);
  }
  let local = rotateX(p - ball, -params.ballSpin);
  let toSun = sunDir(t);
  let sol = sunColor();
  let shadow = sunShadow(p + n * 0.012, toSun);
  let h = normalize(toSun - rd);
  let r = reflect(rd, n);
  let fresnel = mix(0.04, 0.32, pow(1.0 - max(dot(n, -rd), 0.0), 3.2));

  let plates = ballAlbedo(local);
  let refl = voidColor(r) * 0.08 + sunDisk(r, toSun) * 0.12;
  let toRing = normalize(vec3f(0.0, -p.y, -p.z));
  let ringFacing = max(dot(r, toRing), 0.0);
  let ringGlint = vec3f(0.2, 0.24, 0.28) * pow(ringFacing, 6.0);
  let glowGlint = vec3f(0.12, 0.55, 0.5) * pow(ringFacing, 14.0) * (0.25 + 0.75 * exp(-abs(ball.x) * 0.25));

  let spec = pow(max(dot(n, h), 0.0), 90.0);
  let diff = max(dot(n, toSun), 0.0);
  let lit = plates * (0.04 + sol * diff * shadow * 1.65);
  let core = vec3f(0.12, 0.45, 0.42) * (0.05 + 0.04 * sin(t * 3.0 + ball.x * 2.0));
  return mix(lit, refl + ringGlint + glowGlint, fresnel) + sol * spec * shadow * 0.5 + core;
}

/** Bloom / corona when a ray skims the plasma mass. */
fn plasmaHalo(ro: vec3f, rd: vec3f, ball: vec3f, t: f32, maxDepth: f32) -> vec3f {
  if (!plasmaOn()) {
    return vec3f(0.0);
  }
  let toC = ball - ro;
  let depth = dot(toC, rd);
  if (depth < 0.05 || depth > maxDepth) {
    return vec3f(0.0);
  }
  let closest = length(toC - rd * depth);
  let core = exp(-pow(closest / (BALL_RADIUS * 0.95), 2.0) * 2.8);
  let glow = exp(-pow(closest / (BALL_RADIUS * 2.6), 2.0) * 1.6);
  let tint = plasmaTint(t);
  return tint * (core * 1.8 + glow * 0.55);
}

fn fieldVeil(ro: vec3f, rd: vec3f, ball: vec3f, t: f32, maxDepth: f32) -> vec3f {
  let stretch = abs(ball.x) / AMPLITUDE;
  var veil = vec3f(0.0);
  for (var i = 0; i < 6; i++) {
    let s = 1.0 + f32(i) * 0.85;
    if (s >= maxDepth) {
      break;
    }
    let sample = ro + rd * s;
    let axis = length(sample.yz);
    let along = abs(sample.x);
    let thread = exp(-axis * 9.0) * smoothstep(AMPLITUDE + 0.8, 0.3, along);
    let flicker = 0.5 + 0.5 * simplex3d(sample * 2.2 + vec3f(t * 0.12, 0.0, 0.0));
    let tint = mix(vec3f(0.1, 0.7, 0.65), vec3f(0.45, 0.25, 0.9), stretch);
    veil += tint * thread * flicker * (0.05 + stretch * 0.1);
  }
  return veil;
}

fn dust(ro: vec3f, rd: vec3f, ball: vec3f, t: f32, maxDepth: f32) -> vec3f {
  var acc = vec3f(0.0);
  for (var i = 0; i < 16; i++) {
    let seed = hash3(vec3f(f32(i) + 1.0, 17.0, 91.0));
    let pos = vec3f(
      (seed.x - 0.5) * AMPLITUDE * 2.4,
      (seed.y - 0.5) * 2.2,
      (seed.z - 0.5) * 2.2,
    );
    let drift = pos + vec3f(
      0.0,
      0.05 * sin(t * 0.35 + seed.y * 6.0),
      0.05 * cos(t * 0.3 + seed.z * 5.0),
    );
    let toP = drift - ro;
    let depth = dot(toP, rd);
    if (depth < 0.5 || depth > min(18.0, maxDepth)) {
      continue;
    }
    let closest = length(toP - rd * depth);
    let spark = exp(-closest * closest * 900.0);
    let align = exp(-length(drift.yz) * 1.6) * (0.3 + 0.7 * abs(drift.x) / AMPLITUDE);
    acc += vec3f(0.45, 0.85, 0.9) * spark * align * 0.45;
  }
  return acc;
}

fn cameraRay(uv: vec2f) -> array<vec3f, 2> {
  let ro = params.cameraPos.xyz;
  // Orientation basis only — star directions ignore camera translation.
  let forward = params.cameraForward.xyz;
  let right = params.cameraRight.xyz;
  let up = params.cameraUp.xyz;
  let ndc = vec2f((uv.x * 2.0 - 1.0) * params.aspect, uv.y * 2.0 - 1.0);
  let rd = normalize(forward * 1.85 + right * ndc.x + up * ndc.y);
  return array<vec3f, 2>(ro, rd);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let t = params.time;
  let ball = params.ballPos.xyz;
  let cam = cameraRay(uv);
  let ro = cam[0];
  let rd = cam[1];

  let hit = raymarch(ro, rd);
  var color = envColor(rd);
  var depth = MAX_DIST;

  if (hit.x > 0.0) {
    depth = hit.x;
    let p = ro + rd * hit.x;
    let n = calcNormal(p);
    if (hit.y < 1.5) {
      color = shadeRing(p, n, rd, ball, t);
    } else {
      color = shadeBall(p, n, rd, ball, t);
    }
    // Distance fog uses void only — never pull starfield through the hull.
    let fog = 1.0 - exp(-hit.x * hit.x * 0.0018);
    color = mix(color, voidColor(rd), fog * 0.35);
  }

  color += fieldVeil(ro, rd, ball, t, depth);
  color += dust(ro, rd, ball, t, depth);
  color += plasmaHalo(ro, rd, ball, t, depth);

  color = color / (color + vec3f(1.0));
  color = pow(color, vec3f(0.92));
  return vec4f(color, 1.0);
}
