import { fbmSimplex2d } from "@vgpu/wgsl-std/noise/simplex";

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
  return out;
}

@fragment fn fs_main(@location(0) worldPos: vec3f) -> @location(0) vec4f {
  let n = vec3f(0.0, 1.0, 0.0);
  let light = normalize(vec3f(-0.35, 0.7, 0.4));
  let grass = fbmSimplex2d(worldPos.xz * 0.18, 4, 2.15, 0.5) * 0.5 + 0.5;
  let patchNoise = fbmSimplex2d(worldPos.xz * 0.045, 3, 2.1, 0.52) * 0.5 + 0.5;
  let wet = fbmSimplex2d(worldPos.xz * 0.012 + 8.0, 2, 2.0, 0.5) * 0.5 + 0.5;
  let meadow = mix(vec3f(0.07, 0.09, 0.05), vec3f(0.12, 0.16, 0.07), grass);
  let marsh = mix(meadow, vec3f(0.05, 0.07, 0.06), smoothstep(0.35, 0.7, wet));
  let albedo = mix(marsh, vec3f(0.16, 0.12, 0.07), patchNoise * 0.35);
  let wrap = max(dot(n, light), 0.18);
  let fog = smoothstep(18.0, 40.0, length(worldPos.xz));
  let dusk = vec3f(0.22, 0.14, 0.12);
  let color = mix(albedo * wrap * 1.6, dusk, fog);
  return vec4f(color, 1.0);
}
