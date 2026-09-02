struct Camera {
  viewProjection: mat4x4f,
  invViewProjection: mat4x4f,
  cameraPos: vec3f,
  time: f32,
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
@group(0) @binding(1) var<uniform> sun: Sun;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
}

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) material: f32,
) -> VertexOut {
  var out: VertexOut;
  let world = vec4f(position, 1.0);
  out.worldPos = world.xyz;
  out.position = camera.viewProjection * world;
  out.position.z = out.position.w * 0.999;
  return out;
}

fn skyColor(dir: vec3f) -> vec3f {
  let up = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  let night = 1.0 - smoothstep(-0.06, 0.14, sun.direction.y);
  let zenith = mix(vec3f(0.03, 0.04, 0.08), vec3f(0.32, 0.56, 0.95), 1.0 - night);
  let horizon = mix(vec3f(0.04, 0.05, 0.08), vec3f(0.78, 0.68, 0.52), 1.0 - night);
  let golden = smoothstep(0.28, 0.0, sun.direction.y) * (1.0 - night);
  let horz = mix(horizon, vec3f(1.05, 0.48, 0.18), golden);
  var color = mix(horz, zenith, pow(up, 0.72));
  let sunDir = normalize(sun.direction);
  let mu = max(dot(dir, sunDir), 0.0);
  let disc = smoothstep(0.9996, 0.99985, mu) * (1.0 - night);
  let glow = pow(mu, 24.0) * max(sun.intensity, 0.2) * 0.35 * (1.0 - night);
  let limb = mix(vec3f(1.0, 0.55, 0.2), vec3f(1.5, 1.32, 0.95), smoothstep(0.05, 0.4, sun.direction.y));
  color += limb * glow;
  color += limb * disc * 14.0;
  let ground = smoothstep(0.08, -0.12, dir.y);
  let soil = mix(vec3f(0.06, 0.07, 0.06), vec3f(0.22, 0.2, 0.16), 1.0 - night);
  color = mix(color, soil, ground * 0.92);
  return color;
}

@fragment fn fs_main(@location(0) worldPos: vec3f) -> @location(0) vec4f {
  let dir = normalize(worldPos - camera.cameraPos);
  return vec4f(skyColor(dir), 1.0);
}
