import { fbmSimplex2d, fbmSimplex3d } from "@vgpu/wgsl-std/noise/simplex";

struct Camera {
  viewProjection: mat4x4f,
  invViewProjection: mat4x4f,
  cameraPos: vec3f,
  time: f32,
}

struct Model {
  model: mat4x4f,
}

struct Sun {
  lightViewProjection: mat4x4f,
  direction: vec3f,
  intensity: f32,
  color: vec3f,
  bias: f32,
  ambient: vec3f,
  mapSize: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> model: Model;
@group(0) @binding(2) var<uniform> sun: Sun;
@group(0) @binding(3) var shadowMap: texture_depth_2d;

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

fn albedo(world: vec3f, n: vec3f, uv: vec2f, matId: f32) -> vec3f {
  if (matId > 0.5 && matId < 1.5) {
    let lichen = fbmSimplex3d(world * 18.0, 3, 2.17, 0.5) * 0.5 + 0.5;
    return mix(srgb(vec3f(0.22, 0.18, 0.14)), srgb(vec3f(0.32, 0.36, 0.22)), lichen * 0.35);
  }
  if (matId > 1.5 && matId < 2.5) {
    let wear = fbmSimplex3d(world * 14.0, 3, 2.17, 0.5) * 0.5 + 0.5;
    let verde = smoothstep(0.35, 0.02, abs(n.y));
    let bronze = mix(srgb(vec3f(0.25, 0.16, 0.08)), srgb(vec3f(0.42, 0.28, 0.12)), wear);
    return mix(bronze, srgb(vec3f(0.28, 0.42, 0.26)), verde * 0.55);
  }
  if (matId > 7.5 && matId < 8.5) {
    return srgb(vec3f(0.55, 0.38, 0.16));
  }
  if (matId > 2.5 && matId < 3.5) {
    let tool = fbmSimplex3d(world * vec3f(6.0, 18.0, 6.0), 3, 2.17, 0.5);
    return mix(srgb(vec3f(0.42, 0.38, 0.33)), srgb(vec3f(0.52, 0.48, 0.42)), tool * 0.5 + 0.5);
  }
  if (matId > 3.5 && matId < 4.5) {
    let g = fbmSimplex2d(world.xz * 7.5, 4, 2.17, 0.5);
    return mix(srgb(vec3f(0.38, 0.3, 0.2)), srgb(vec3f(0.55, 0.45, 0.3)), g * 0.5 + 0.5);
  }
  if (matId > 4.5 && matId < 5.5) {
    let leaf = fbmSimplex3d(world * 5.5, 3, 2.17, 0.5);
    return mix(srgb(vec3f(0.12, 0.2, 0.1)), srgb(vec3f(0.22, 0.34, 0.14)), leaf * 0.5 + 0.5);
  }
  if (matId > 5.5 && matId < 6.5) {
    return mix(srgb(vec3f(0.08, 0.16, 0.08)), srgb(vec3f(0.16, 0.28, 0.12)), abs(n.y));
  }
  if (matId > 6.5 && matId < 7.5) {
    return srgb(vec3f(0.48, 0.44, 0.38));
  }
  let pit = fbmSimplex3d(world * 9.0, 4, 2.17, 0.5);
  var lime = mix(srgb(vec3f(0.58, 0.54, 0.46)), srgb(vec3f(0.7, 0.66, 0.58)), pit * 0.5 + 0.5);
  lime *= 1.0 - 0.12 * smoothstep(0.92, 1.0, max(uv.x, uv.y));
  return lime;
}

fn roughnessOf(matId: f32) -> f32 {
  if (matId > 1.5 && matId < 2.5) { return 0.28; }
  if (matId > 7.5 && matId < 8.5) { return 0.18; }
  if (matId > 0.5 && matId < 1.5) { return 0.72; }
  if (matId > 3.5 && matId < 4.5) { return 0.78; }
  return 0.55;
}

fn shadowVisibility(world: vec3f, n: vec3f, matId: f32) -> f32 {
  if (sun.intensity < 0.02) { return 1.0; }
  if (matId > 1.5 && matId < 2.6) { return 1.0; }
  if (matId > 7.5 && matId < 8.6) { return 1.0; }
  let lp = sun.lightViewProjection * vec4f(world, 1.0);
  let ndc = lp.xyz / lp.w;
  let uv = vec2f(ndc.x * 0.5 + 0.5, -ndc.y * 0.5 + 0.5);
  if (uv.x <= 0.001 || uv.x >= 0.999 || uv.y <= 0.001 || uv.y >= 0.999 || ndc.z <= 0.0 || ndc.z >= 1.0) {
    return 1.0;
  }
  let ndl = max(dot(n, sun.direction), 0.0);
  let bias = sun.bias + (1.0 - ndl) * 0.0018;
  let refDepth = ndc.z - bias;
  let dims = vec2<i32>(textureDimensions(shadowMap));
  var sum = 0.0;
  let radius = i32(max(sun.mapSize * 0.0 + 1.0, 1.0));
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let texel = vec2<i32>(uv * vec2f(dims)) + vec2<i32>(x, y) * radius;
      let stored = textureLoad(shadowMap, texel, 0);
      sum += select(0.0, 1.0, stored >= refDepth);
    }
  }
  return sum / 9.0;
}

fn lighting(world: vec3f, n: vec3f, color: vec3f, matId: f32) -> vec3f {
  let view = normalize(camera.cameraPos - world);
  let ndl = max(dot(n, sun.direction), 0.0);
  let wrap = max(dot(n, sun.direction) * 0.45 + 0.55, 0.0);
  let shadow = shadowVisibility(world, n, matId);
  let hemi = mix(sun.ambient * 0.45, sun.ambient, n.y * 0.5 + 0.5);
  let bounce = vec3f(0.28, 0.2, 0.12) * max(-n.y, 0.0) * 0.18;
  let key = sun.color * sun.intensity * mix(ndl, wrap, 0.2) * shadow;
  let h = normalize(sun.direction + view);
  let rough = roughnessOf(matId);
  let spec = pow(max(dot(n, h), 0.0), mix(18.0, 90.0, 1.0 - rough)) * (1.0 - rough) * 0.38 * shadow;
  var lit = color * (key + hemi + bounce) + spec * sun.color * sun.intensity;
  let r = length(world.xz);
  let contact = exp(-pow(r / 0.55, 2.0)) * smoothstep(0.08, -0.02, world.y + 0.9) * 0.22;
  lit *= 1.0 - contact;
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
  let lit = lighting(worldPos, n, color, material);
  return vec4f(lit, 1.0);
}
