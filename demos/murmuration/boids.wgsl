struct Boid {
  position: vec3f,
  alive: f32,
  velocity: vec3f,
  phase: f32,
}

struct Sim {
  dt: f32,
  scare: f32,
  time: f32,
  seed: f32,
  mouse: vec3f,
  minSpeed: f32,
  sep: f32,
  align: f32,
  coh: f32,
  maxSpeed: f32,
}

struct Counters {
  packed: atomic<u32>,
  scan: u32,
  _pad0: u32,
  _pad1: u32,
}

struct MeshInfo {
  indexCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
}

@group(0) @binding(0) var<storage, read> src: array<Boid>;
@group(0) @binding(1) var<storage, read_write> dst: array<Boid>;
@group(0) @binding(2) var<uniform> sim: Sim;
@group(0) @binding(3) var<storage, read_write> counters: Counters;
@group(0) @binding(4) var<storage, read_write> dispatchArgs: array<u32, 3>;
@group(0) @binding(5) var<storage, read_write> drawArgs: array<u32, 5>;
@group(0) @binding(6) var<uniform> mesh: MeshInfo;

fn limit(v: vec3f, maxLen: f32) -> vec3f {
  let len = length(v);
  if (len > maxLen && len > 1e-6) {
    return v * (maxLen / len);
  }
  return v;
}

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  let n = counters.scan;
  if (id >= n) { return; }

  let mine = src[id];
  var pos = mine.position;
  var vel = mine.velocity;
  let speed0 = max(length(vel), 0.05);
  let heading = vel / speed0;

  var sep = vec3f(0.0);
  var ali = vec3f(0.0);
  var coh = vec3f(0.0);
  var nSep = 0.0;
  var nFlock = 0.0;

  let perc2 = 2.4 * 2.4;
  let sep2 = 0.38 * 0.38;

  for (var j = 0u; j < n; j++) {
    if (j == id) { continue; }
    let other = src[j];
    let delta = other.position - pos;
    let d2 = dot(delta, delta);
    if (d2 > perc2 || d2 < 1e-8) { continue; }
    if (d2 < sep2) {
      sep -= delta / d2;
      nSep += 1.0;
    }
    ali += other.velocity;
    coh += other.position;
    nFlock += 1.0;
  }

  var accel = vec3f(0.0);
  if (nSep > 0.0) {
    accel += limit(sep / nSep, 6.0) * sim.sep;
  }
  if (nFlock > 0.0) {
    let meanVel = ali / nFlock;
    let meanPos = coh / nFlock;
    accel += limit(meanVel - vel, 4.0) * sim.align;
    accel += limit(meanPos - pos, 4.0) * sim.coh;
  }

  let home = vec3f(0.0, 3.2, 0.0);
  let offset = pos - home;
  let ell = vec3f(offset.x / 7.2, offset.y / 2.6, offset.z / 5.4);
  let e2 = dot(ell, ell);
  if (e2 > 1.0) {
    accel += -offset * (e2 - 1.0) * 1.8;
  }
  accel += vec3f(0.0, (3.2 - pos.y) * 0.35, 0.0);

  let swirl = vec3f(-offset.z, 0.0, offset.x);
  accel += normalize(swirl + vec3f(0.001, 0.0, 0.0)) * 0.55;

  let toMouse = pos - sim.mouse;
  let m2 = dot(toMouse, toMouse);
  let flee = toMouse / (m2 + 0.22) * sim.scare * 34.0;
  accel += flee;

  vel += accel * sim.dt;
  var speed = length(vel);
  speed = clamp(speed, sim.minSpeed, sim.maxSpeed);
  vel = normalize(vel + heading * 0.02) * speed;
  pos += vel * sim.dt;

  var next: Boid;
  next.position = pos;
  next.velocity = vel;
  next.phase = mine.phase + speed * 11.0 * sim.dt;
  let escaped = length(pos - home) > 11.5;
  let grounded = pos.y < 0.12;
  next.alive = select(1.0, 0.0, escaped || grounded);
  dst[id] = next;
}

@compute @workgroup_size(1)
fn resetPacked() {
  atomicStore(&counters.packed, 0u);
}

@compute @workgroup_size(64)
fn compact(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= counters.scan) { return; }
  let boid = src[id];
  if (boid.alive > 0.5) {
    let slot = atomicAdd(&counters.packed, 1u);
    dst[slot] = boid;
  }
}

@compute @workgroup_size(1)
fn counts() {
  let n = atomicLoad(&counters.packed);
  counters.scan = n;
  dispatchArgs[0] = (n + 63u) / 64u;
  dispatchArgs[1] = 1u;
  dispatchArgs[2] = 1u;
  drawArgs[0] = mesh.indexCount;
  drawArgs[1] = n;
  drawArgs[2] = 0u;
  drawArgs[3] = 0u;
  drawArgs[4] = 0u;
}
