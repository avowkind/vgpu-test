import { fbmPerlin3d, perlin2d, perlin3d } from "@vgpu/wgsl-std/noise/perlin";
import { hash2, hash3 } from "@vgpu/wgsl-std/hash";

struct Camera {
  viewProjection: mat4x4f,
  cameraPos: vec3f,
  time: f32,
}

struct Model {
  model: mat4x4f,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> model: Model;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) material: f32,
}

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) material: f32,
) -> VertexOut {
  var out: VertexOut;
  let world = model.model * vec4f(position, 1.0);
  out.worldPos = world.xyz;
  out.position = camera.viewProjection * world;
  out.normal = normalize((model.model * vec4f(normal, 0.0)).xyz);
  out.uv = uv;
  out.material = material;
  return out;
}

fn srgb(c: vec3f) -> vec3f {
  return pow(max(c, vec3f(0.0)), vec3f(2.2));
}

fn wood(p: vec3f, dark: vec3f, light: vec3f, tight: f32) -> vec3f {
  let grainP = p * vec3f(0.55, 3.4, 0.55) * tight;
  let n = fbmPerlin3d(grainP, 4, 2.17, 0.5);
  let warp = perlin3d(p * 0.35 + vec3f(2.1, 0.4, 8.2));
  let rings = sin(p.x * 1.8 * tight + p.z * 0.35 + n * 3.6 + warp * 1.4);
  let grain = rings * 0.5 + 0.5;
  return mix(dark, light, clamp(0.42 + grain * 0.28, 0.0, 1.0));
}

fn shadeWood(world: vec3f, n: vec3f, matId: f32) -> vec3f {
  if (matId < 0.5) {
    return wood(world, srgb(vec3f(0.92, 0.9, 0.84)), srgb(vec3f(0.99, 0.98, 0.94)), 0.35);
  }
  if (matId < 1.5) {
    return wood(world, srgb(vec3f(0.04, 0.035, 0.03)), srgb(vec3f(0.11, 0.1, 0.09)), 0.4);
  }
  if (matId < 2.5) {
    return wood(world * 0.45, srgb(vec3f(0.12, 0.07, 0.04)), srgb(vec3f(0.28, 0.16, 0.08)), 0.55);
  }
  if (matId < 3.5) {
    return wood(world, srgb(vec3f(0.28, 0.16, 0.08)), srgb(vec3f(0.5, 0.32, 0.16)), 0.7);
  }
  if (matId < 5.5) {
    return wood(world, srgb(vec3f(0.32, 0.18, 0.08)), srgb(vec3f(0.55, 0.36, 0.18)), 0.9);
  }
  return wood(world, srgb(vec3f(0.2, 0.11, 0.06)), srgb(vec3f(0.4, 0.24, 0.12)), 0.8);
}

fn brass(world: vec3f, n: vec3f) -> vec3f {
  let wear = smoothstep(0.15, 0.7, abs(n.y) + perlin3d(world * 3.4) * 0.35);
  let base = mix(srgb(vec3f(0.42, 0.28, 0.12)), srgb(vec3f(0.72, 0.55, 0.28)), wear);
  let scratch = pow(abs(perlin2d(vec2f(world.y * 8.0, atan2(world.z, world.x) * 6.0))), 8.0);
  return mix(base, srgb(vec3f(0.9, 0.78, 0.5)), scratch * 0.18);
}

fn sandColor(world: vec3f) -> vec3f {
  let h = hash3(world * 18.0);
  let speckle = step(0.93, h.x);
  let gold = mix(srgb(vec3f(0.72, 0.5, 0.24)), srgb(vec3f(0.9, 0.7, 0.38)), h.y);
  return mix(gold, srgb(vec3f(0.28, 0.16, 0.1)), speckle);
}

fn albedo(world: vec3f, n: vec3f, uv: vec2f, matId: f32) -> vec3f {
  if (matId > 3.5 && matId < 4.5) {
    return brass(world, n);
  }
  if (matId > 8.5 && matId < 9.5) {
    return sandColor(world);
  }
  if (matId > 9.5 && matId < 10.5) {
    return srgb(vec3f(0.08, 0.05, 0.03));
  }
  if (matId > 5.5 && matId < 6.5) {
    let plaster = mix(srgb(vec3f(0.42, 0.4, 0.36)), srgb(vec3f(0.55, 0.52, 0.46)), perlin3d(world * 0.08) * 0.5 + 0.5);
    return plaster;
  }
  if (matId > 6.5 && matId < 7.5) {
    let cell = floor(world.xy * vec2f(0.12, 0.09) + vec2f(20.0, 4.0));
    let rnd = hash2(cell);
    let book = mix(srgb(vec3f(0.28, 0.12, 0.08)), srgb(vec3f(0.15, 0.22, 0.18)), rnd.x);
    let book2 = mix(srgb(vec3f(0.4, 0.28, 0.14)), srgb(vec3f(0.18, 0.16, 0.22)), rnd.y);
    return mix(book, book2, step(0.5, rnd.x));
  }
  if (matId > 7.5 && matId < 8.5) {
    return vec3f(8.5, 7.6, 6.2);
  }
  if (matId > 10.5) {
    return srgb(vec3f(0.62, 0.58, 0.5));
  }
  var color = shadeWood(world, n, matId);
  let edgeWear = 1.0 - smoothstep(0.08, 0.22, min(uv.x, min(uv.y, min(1.0 - uv.x, 1.0 - uv.y))));
  color *= 1.0 - edgeWear * 0.18;
  return color;
}

fn lighting(world: vec3f, n: vec3f, color: vec3f, rough: f32) -> vec3f {
  let keyDir = normalize(vec3f(-0.55, 0.72, 0.18));
  let rimDir = normalize(vec3f(0.72, 0.22, -0.18));
  let key = vec3f(1.0, 0.94, 0.84) * 2.35;
  let fill = vec3f(0.42, 0.28, 0.18) * 0.28;
  let rim = vec3f(0.55, 0.7, 0.95) * 0.45;
  let ndl = max(dot(n, keyDir), 0.0);
  let wrap = max(dot(n, keyDir) * 0.5 + 0.5, 0.0);
  let view = normalize(camera.cameraPos - world);
  let h = normalize(keyDir + view);
  let spec = pow(max(dot(n, h), 0.0), mix(24.0, 80.0, 1.0 - rough)) * (1.0 - rough) * 0.35;
  let rimL = pow(max(dot(n, rimDir), 0.0), 2.0) * 0.35;
  var lit = color * (key * mix(ndl, wrap, 0.35) + fill + rim * rimL) + spec * key;
  let r = length(world.xz);
  let contact = exp(-pow(r / 4.6, 2.0)) * smoothstep(0.18, 0.0, world.y) * 0.28;
  lit *= 1.0 - contact;
  let caustic = perlin2d(world.xz * 0.55 + vec2f(camera.time * 0.15, camera.time * 0.08));
  let under = exp(-pow(r / 3.3, 2.0)) * smoothstep(0.4, 0.0, abs(world.y));
  lit += vec3f(0.22, 0.16, 0.08) * max(caustic, 0.0) * under * 0.45;
  return lit;
}

@fragment fn fs_main(
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) material: f32,
) -> @location(0) vec4f {
  var n = normalize(normal);
  if (dot(n, normalize(camera.cameraPos - worldPos)) < 0.0) { n = -n; }
  let color = albedo(worldPos, n, uv, material);
  var rough = 0.55;
  if (material > 3.5 && material < 4.5) { rough = 0.22; }
  if (material > 8.5 && material < 9.5) { rough = 0.62; }
  if (material > 7.5 && material < 8.5) { rough = 1.0; }
  let lit = lighting(worldPos, n, color, rough);
  return vec4f(lit, 1.0);
}
