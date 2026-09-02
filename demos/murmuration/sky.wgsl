struct Camera {
  viewProjection: mat4x4f,
  invViewProjection: mat4x4f,
  cameraPos: vec3f,
  time: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
}

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) wing: f32,
) -> VertexOut {
  var out: VertexOut;
  out.worldPos = position;
  out.position = camera.viewProjection * vec4f(position, 1.0);
  out.position.z = out.position.w * 0.999;
  return out;
}

fn skyColor(dir: vec3f) -> vec3f {
  let up = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  let zenith = vec3f(0.22, 0.48, 0.98);
  let mid = vec3f(0.40, 0.66, 1.05);
  let horizon = vec3f(0.68, 0.84, 1.05);
  var color = mix(horizon, mid, pow(up, 0.55));
  color = mix(color, zenith, pow(up, 1.45));
  let sunDir = normalize(vec3f(-0.32, 0.48, 0.52));
  let mu = max(dot(dir, sunDir), 0.0);
  let glow = pow(mu, 22.0) * 0.38;
  let disc = smoothstep(0.9994, 0.99985, mu);
  color += vec3f(1.05, 0.95, 0.72) * glow;
  color += vec3f(1.5, 1.38, 1.15) * disc * 7.0;
  let ground = smoothstep(0.06, -0.18, dir.y);
  color = mix(color, vec3f(0.08, 0.12, 0.1), ground * 0.92);
  return color;
}

@fragment fn fs_main(@location(0) worldPos: vec3f) -> @location(0) vec4f {
  let dir = normalize(worldPos - camera.cameraPos);
  return vec4f(skyColor(dir), 1.0);
}
