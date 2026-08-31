import { tonemapAces, applyExposure } from "@vgpu/wgsl-std/color";

struct Present {
  focus: f32,
  texelX: f32,
  texelY: f32,
  _pad: f32,
}

@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var sceneSampler: sampler;
@group(0) @binding(2) var sceneDepth: texture_depth_2d;
@group(0) @binding(3) var<uniform> present: Present;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(sceneDepth));
  let depth = textureLoad(sceneDepth, vec2i(uv * dims), 0);
  let coc = clamp(abs(depth - present.focus) * 18.0, 0.0, 1.6);
  let t = vec2f(present.texelX, present.texelY) * coc;
  var color = textureSampleLevel(scene, sceneSampler, uv, 0.0).xyz * 0.36;
  color += textureSampleLevel(scene, sceneSampler, uv + vec2f(t.x, 0.0), 0.0).xyz * 0.16;
  color += textureSampleLevel(scene, sceneSampler, uv - vec2f(t.x, 0.0), 0.0).xyz * 0.16;
  color += textureSampleLevel(scene, sceneSampler, uv + vec2f(0.0, t.y), 0.0).xyz * 0.16;
  color += textureSampleLevel(scene, sceneSampler, uv - vec2f(0.0, t.y), 0.0).xyz * 0.16;
  let mapped = tonemapAces(applyExposure(color, 0.55));
  let vig = smoothstep(1.15, 0.35, length(uv - vec2f(0.5)));
  return vec4f(mapped * mix(0.86, 1.0, vig), 1.0);
}
