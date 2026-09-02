import { applyExposure, tonemapAces } from "@vgpu/wgsl-std/color";

struct Present {
  exposure: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var sceneSampler: sampler;
@group(0) @binding(2) var<uniform> present: Present;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let color = textureSampleLevel(scene, sceneSampler, uv, 0.0).xyz;
  let mapped = tonemapAces(applyExposure(color, present.exposure));
  let vig = smoothstep(1.25, 0.42, length(uv - vec2f(0.5)));
  return vec4f(mapped * mix(0.86, 1.0, vig), 1.0);
}
