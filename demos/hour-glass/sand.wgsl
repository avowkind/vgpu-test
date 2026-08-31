struct Camera {
  viewProjection: mat4x4f,
  cameraPos: vec3f,
  time: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec3f,
}

@vertex fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) iPos: vec4f,
  @location(3) iColor: vec4f,
) -> VertexOut {
  var out: VertexOut;
  let scaled = vec3f(
    position.x * mix(0.7, 1.15, fract(iColor.w * 3.1)),
    position.y * mix(0.35, 0.7, fract(iColor.w * 5.7)),
    position.z * mix(0.65, 1.1, fract(iColor.w * 7.3)),
  ) * iPos.w;
  let world = iPos.xyz + scaled;
  out.worldPos = world;
  out.position = camera.viewProjection * vec4f(world, 1.0);
  out.normal = normalize(vec3f(normal.x, normal.y * 1.6, normal.z));
  out.color = iColor.xyz;
  return out;
}

@fragment fn fs_main(
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec3f,
) -> @location(0) vec4f {
  let n = normalize(normal);
  let keyDir = normalize(vec3f(-0.55, 0.72, 0.18));
  let view = normalize(camera.cameraPos - worldPos);
  let wrap = max(dot(n, keyDir) * 0.35 + 0.65, 0.0);
  let h = normalize(keyDir + view);
  let spec = pow(max(dot(n, h), 0.0), 48.0) * 0.08;
  let fill = 0.22;
  let gold = pow(max(color, vec3f(0.0)), vec3f(2.2));
  let lit = gold * (vec3f(1.0, 0.94, 0.84) * 2.1 * wrap + vec3f(0.4, 0.26, 0.16) * fill) + spec * vec3f(1.0, 0.9, 0.7);
  return vec4f(lit, 1.0);
}
