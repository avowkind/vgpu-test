import { hashU32, unitFloat } from "@vgpu/wgsl-std/hash";

struct Boid {
  position: vec3f,
  alive: f32,
  velocity: vec3f,
  phase: f32,
}

struct Camera {
  viewProjection: mat4x4f,
  invViewProjection: mat4x4f,
  cameraPos: vec3f,
  time: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read> boids: array<Boid>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) view: vec3f,
  @location(3) tint: f32,
}

fn basis(forward: vec3f) -> mat3x3f {
  let z = normalize(forward);
  var up = vec3f(0.0, 1.0, 0.0);
  if (abs(dot(z, up)) > 0.94) {
    up = vec3f(0.0, 0.0, 1.0);
  }
  let x = normalize(cross(up, z));
  let y = cross(z, x);
  return mat3x3f(x, y, z);
}

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) wing: f32,
  @builtin(instance_index) inst: u32,
) -> VertexOut {
  let boid = boids[inst];
  let flap = sin(boid.phase) * 0.55;
  var local = position * 1.55;
  if (wing > 0.5) {
    let side = select(-1.0, 1.0, wing > 1.5);
    local.y += flap * abs(position.x) * 1.15;
    local.x += side * flap * 0.04;
  }

  let axes = basis(boid.velocity + vec3f(0.0, 0.0, 0.001));
  let world = boid.position + axes * local;
  let worldN = normalize(axes * normal);

  var out: VertexOut;
  out.position = camera.viewProjection * vec4f(world, 1.0);
  out.worldPos = world;
  out.normal = worldN;
  out.view = camera.cameraPos - world;
  out.tint = unitFloat(hashU32(inst * 747796405u + 2891336453u));
  return out;
}

@fragment fn fs_main(
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) view: vec3f,
  @location(3) tint: f32,
) -> @location(0) vec4f {
  let n = normalize(normal);
  let v = normalize(view);
  let light = normalize(vec3f(-0.35, 0.55, 0.45));
  let wrap = max(dot(n, light) * 0.4 + 0.45, 0.08);
  let fres = pow(1.0 - max(dot(n, v), 0.0), 2.8);
  let sheenA = vec3f(0.08, 0.32, 0.2);
  let sheenB = vec3f(0.22, 0.08, 0.32);
  let sheen = mix(sheenA, sheenB, tint);
  let body = vec3f(0.018, 0.016, 0.014);
  let color = body * wrap * 1.35 + sheen * fres * 0.4;
  let rim = pow(1.0 - max(dot(n, v), 0.0), 3.2) * 0.12;
  let dusk = vec3f(0.55, 0.28, 0.14) * rim;
  let spec = pow(max(dot(n, normalize(light + v)), 0.0), 48.0) * 0.08;
  return vec4f(color + dusk + spec * sheen, 1.0);
}
