struct Light {
  viewProjection: mat4x4f,
}

struct Model {
  model: mat4x4f,
}

@group(0) @binding(0) var<uniform> light: Light;
@group(0) @binding(1) var<uniform> model: Model;

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) material: f32,
) -> @builtin(position) vec4f {
  return light.viewProjection * model.model * vec4f(position, 1.0);
}

@fragment fn fs_main() -> @location(0) vec4f {
  return vec4f(0.0, 0.0, 0.0, 1.0);
}
