import { fbmPerlin3d, perlin2d } from "@vgpu/wgsl-std/noise/perlin";
import { hash1 } from "@vgpu/wgsl-std/hash";

struct Camera {
  viewProjection: mat4x4f,
  cameraPos: vec3f,
  time: f32,
}

struct GlassParams {
  ior: f32,
  thicknessScale: f32,
  dispersion: f32,
  absorption: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> glass: GlassParams;
@group(0) @binding(2) var sceneTex: texture_2d<f32>;
@group(0) @binding(3) var sceneSampler: sampler;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) thickness: f32,
  @location(4) clip: vec4f,
}

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) thickness: f32,
) -> VertexOut {
  var out: VertexOut;
  out.worldPos = position;
  out.position = camera.viewProjection * vec4f(position, 1.0);
  out.normal = normal;
  out.uv = uv;
  out.thickness = thickness;
  out.clip = out.position;
  return out;
}

fn envReflect(dir: vec3f) -> vec3f {
  let sky = mix(vec3f(0.18, 0.2, 0.24), vec3f(1.6, 1.45, 1.2), pow(max(dir.y, 0.0), 0.55));
  let window = exp(-pow(length(dir.xy - vec2f(-0.35, 0.28)) * 2.4, 2.0)) * vec3f(3.4, 3.0, 2.4);
  let floorC = vec3f(0.16, 0.1, 0.06) * max(-dir.y, 0.0);
  return sky + window + floorC;
}

fn sampleScene(uv: vec2f) -> vec3f {
  let clamped = clamp(uv, vec2f(0.002), vec2f(0.998));
  let off = max(abs(uv.x - 0.5), abs(uv.y - 0.5));
  let img = textureSampleLevel(sceneTex, sceneSampler, clamped, 0.0).xyz;
  let env = envReflect(vec3f(uv * 2.0 - 1.0, 0.6));
  return mix(img, env, smoothstep(0.49, 0.62, off));
}

fn bubbleWarp(world: vec3f, view: vec3f, offset: vec2f) -> vec2f {
  var extra = vec2f(0.0);
  let bubbles = array<vec4f, 6>(
    vec4f(1.85, 13.4, 0.55, 0.09),
    vec4f(-2.05, 15.1, -0.8, 0.07),
    vec4f(0.35, 6.2, 2.15, 0.11),
    vec4f(-1.4, 4.6, -1.7, 0.06),
    vec4f(2.2, 16.8, 1.1, 0.05),
    vec4f(0.9, 8.7, -2.0, 0.08),
  );
  for (var i = 0; i < 6; i++) {
    let b = bubbles[i];
    let d = world - b.xyz;
    let closest = d - view * dot(d, view);
    let dist = length(closest);
    let w = smoothstep(b.w * 1.8, 0.0, dist);
    extra += normalize(closest.xz + vec2f(0.001)) * w * 0.012;
  }
  return offset + extra;
}

@fragment fn fs_main(
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) thickness: f32,
  @location(4) clip: vec4f,
) -> @location(0) vec4f {
  var n = normalize(normal);
  let view = normalize(camera.cameraPos - worldPos);
  if (dot(n, view) < 0.0) { n = -n; }

  let thick = max(thickness * glass.thicknessScale, 0.12);
  let ior = glass.ior;
  let etaR = 1.0 / (ior - 0.005 * glass.dispersion);
  let etaG = 1.0 / ior;
  let etaB = 1.0 / (ior + 0.008 * glass.dispersion);

  let rR = refract(-view, n, etaR);
  let rG = refract(-view, n, etaG);
  let rB = refract(-view, n, etaB);
  let dR = select(reflect(-view, n), rR, dot(rR, rR) > 1e-8);
  let dG = select(reflect(-view, n), rG, dot(rG, rG) > 1e-8);
  let dB = select(reflect(-view, n), rB, dot(rB, rB) > 1e-8);

  let ndc = clip.xy / max(clip.w, 1e-4);
  let screenUv = ndc * vec2f(0.5, -0.5) + vec2f(0.5);
  let scale = thick * 0.085;

  let cR = camera.viewProjection * vec4f(worldPos + dR * thick * 2.4, 1.0);
  let cG = camera.viewProjection * vec4f(worldPos + dG * thick * 2.4, 1.0);
  let cB = camera.viewProjection * vec4f(worldPos + dB * thick * 2.4, 1.0);
  let oR = cR.xy / max(cR.w, 1e-4) * vec2f(0.5, -0.5) + vec2f(0.5);
  let oG = cG.xy / max(cG.w, 1e-4) * vec2f(0.5, -0.5) + vec2f(0.5);
  let oB = cB.xy / max(cB.w, 1e-4) * vec2f(0.5, -0.5) + vec2f(0.5);

  let warp = bubbleWarp(worldPos, view, vec2f(0.0));
  let finger = smoothstep(0.35, 0.8, fbmPerlin3d(worldPos * 0.45 + vec3f(4.0, 0.0, 1.2), 3, 2.1, 0.5) * 0.5 + 0.5);
  let uvR = oR + warp * glass.dispersion + (oR - screenUv) * (scale - 1.0) * 0.15;
  let uvG = oG + warp;
  let uvB = oB + warp * 0.7;

  var refracted = vec3f(
    sampleScene(uvR).r,
    sampleScene(uvG).g,
    sampleScene(uvB).b,
  );

  let beer = exp(-vec3f(0.55, 0.85, 1.65) * (thick / max(glass.absorption, 0.5)));
  refracted *= beer;

  let reflDir = reflect(-view, n);
  let reflected = envReflect(reflDir);
  let f0 = 0.04;
  let fres = f0 + (1.0 - f0) * pow(1.0 - max(dot(n, view), 0.0), 5.0);
  var color = mix(refracted, reflected, fres);
  let rim = pow(1.0 - max(dot(n, view), 0.0), 2.4);
  color += vec3f(0.62, 0.78, 0.82) * rim * 0.55;

  let scratch = pow(abs(perlin2d(vec2f(worldPos.y * 6.5, atan2(worldPos.z, worldPos.x) * 9.0))), 12.0);
  let dust = hash1(worldPos.x * 19.0 + worldPos.y * 7.0 + worldPos.z * 3.0);
  color += vec3f(0.08) * scratch;
  color += vec3f(0.04, 0.04, 0.035) * step(0.992, dust);
  color *= mix(1.0, 0.92, finger * 0.5);

  let alpha = mix(0.16, 0.08, fres) + 0.84;
  return vec4f(color, alpha);
}
