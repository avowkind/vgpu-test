struct Camera {
  viewProjection: mat4x4f,
}

struct Model {
  model: mat4x4f,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> model: Model;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) color: vec3f,
}

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec3f,
) -> VertexOut {
  var out: VertexOut;
  out.position = camera.viewProjection * model.model * vec4f(position, 1.0);
  out.normal = (model.model * vec4f(normal, 0.0)).xyz;
  out.color = color;
  return out;
}

@fragment fn fs_main(
  @location(0) normal: vec3f,
  @location(1) color: vec3f,
) -> @location(0) vec4f {
  let lightDir = normalize(vec3f(0.45, 0.85, 0.35));
  let n = normalize(normal);
  let diffuse = max(dot(n, lightDir), 0.0);
  let lit = color * (0.28 + 0.72 * diffuse);
  return vec4f(lit, 1.0);
}
