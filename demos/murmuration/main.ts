import {
  clock,
  compute,
  draw,
  effect,
  frameLoop,
  geometry,
  init,
  pingPongStorage,
  sampler,
  storage,
  surface,
  target,
  uniforms,
} from "vgpu";
import { orbitControls, perspectiveCamera } from "vgpu/scene";
import birdShader from "./bird.wgsl";
import boidsShader from "./boids.wgsl";
import { initialDispatchArgs, initialDrawArgs, seedFlock } from "./boids";
import {
  BOID_BYTES,
  DEFAULT_ALIGN,
  DEFAULT_COH,
  DEFAULT_FLOCK,
  DEFAULT_SEP,
  DEFAULT_SPEED,
  FLOCK_Y,
  MAX_BOIDS,
  MAX_GROUPS,
  WORKGROUP,
} from "./constants";
import groundShader from "./ground.wgsl";
import { invertMat4, unprojectToPlaneY } from "./math";
import { createBird, createGround, createSkyCube, STRIDE } from "./meshes";
import { canvasPointer } from "./pointer";
import presentShader from "./present.wgsl";
import skyShader from "./sky.wgsl";
import "./style.css";

function meshGeometry(gpu: Awaited<ReturnType<typeof init>>, mesh: ReturnType<typeof createBird>) {
  return geometry(gpu, {
    buffers: [
      {
        data: mesh.vertices,
        stride: STRIDE * 4,
        attributes: {
          position: "float32x3",
          normal: { format: "float32x3", offset: 12 },
          wing: { format: "float32", offset: 24 },
        },
      },
    ],
    indices: mesh.indices,
  });
}

async function main() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app missing");

  let sep = DEFAULT_SEP;
  let align = DEFAULT_ALIGN;
  let coh = DEFAULT_COH;
  let maxSpeed = DEFAULT_SPEED;
  let flockSize = DEFAULT_FLOCK;
  let aliveHud = flockSize;
  let reading = false;
  let pulse = 0;

  app.innerHTML = `
    <canvas id="viewport" aria-label="Murmuration viewport"></canvas>
    <a class="back" href="${import.meta.env.BASE_URL}">All demos</a>
    <aside class="hud">
      <h1>Murmuration</h1>
      <p>Move to stir the flock · click to scatter · drag to orbit. Birds that bolt too far compact away.</p>
    </aside>
    <aside class="panel">
      <label>
        <span>flock_size</span>
        <span data-val="flock">${flockSize}</span>
        <input type="range" id="flock" min="64" max="${MAX_BOIDS}" step="64" value="${flockSize}" />
      </label>
      <label>
        <span>separation</span>
        <span data-val="sep">${sep.toFixed(2)}</span>
        <input type="range" id="sep" min="0.2" max="2.4" step="0.05" value="${sep}" />
      </label>
      <label>
        <span>alignment</span>
        <span data-val="align">${align.toFixed(2)}</span>
        <input type="range" id="align" min="0.1" max="1.8" step="0.05" value="${align}" />
      </label>
      <label>
        <span>cohesion</span>
        <span data-val="coh">${coh.toFixed(2)}</span>
        <input type="range" id="coh" min="0.1" max="1.4" step="0.05" value="${coh}" />
      </label>
      <label>
        <span>max_speed</span>
        <span data-val="speed">${maxSpeed.toFixed(1)}</span>
        <input type="range" id="speed" min="2.5" max="8" step="0.1" value="${maxSpeed}" />
      </label>
      <button type="button" id="reset">Reset flock</button>
      <p class="readout" id="readout"></p>
    </aside>
  `;

  const canvas = app.querySelector<HTMLCanvasElement>("#viewport")!;
  const readout = app.querySelector<HTMLParagraphElement>("#readout")!;
  const bindSlider = (id: string, write: (v: number) => void, digits: number) => {
    const input = app.querySelector<HTMLInputElement>(`#${id}`)!;
    const label = app.querySelector(`[data-val="${id}"]`)!;
    input.addEventListener("input", () => {
      const value = Number(input.value);
      write(value);
      label.textContent = value.toFixed(digits);
    });
  };
  bindSlider("sep", (v) => { sep = v; }, 2);
  bindSlider("align", (v) => { align = v; }, 2);
  bindSlider("coh", (v) => { coh = v; }, 2);
  bindSlider("speed", (v) => { maxSpeed = v; }, 1);

  const gpu = await init();
  const canvasSurface = surface(gpu, canvas, { dpr: [1, 2] });
  const sceneTarget = target(gpu, {
    size: canvasSurface.size,
    format: "rgba16float",
    depth: true,
  });

  const birdMesh = createBird();
  const groundMesh = createGround();
  const skyMesh = createSkyCube();
  const birdGeo = meshGeometry(gpu, birdMesh);
  const groundGeo = meshGeometry(gpu, groundMesh);
  const skyGeo = meshGeometry(gpu, skyMesh);
  const indexCount = birdMesh.indices.length;

  const flock = pingPongStorage(gpu, MAX_BOIDS * BOID_BYTES);
  const counters = storage(gpu, 16);
  const dispatchArgs = storage(gpu, 12, { indirect: true });
  const drawArgs = storage(gpu, 20, { indirect: true });

  const seed = (count = flockSize) => {
    const n = Math.max(1, Math.min(MAX_BOIDS, Math.round(count)));
    flockSize = n;
    const data = seedFlock(n);
    flock.read.write(data);
    flock.write.write(data);
    counters.write(new Uint32Array([n, n, 0, 0]) as Uint32Array<ArrayBuffer>);
    dispatchArgs.write(initialDispatchArgs(n, WORKGROUP));
    drawArgs.write(initialDrawArgs(indexCount, n));
    aliveHud = n;
  };
  seed();

  const flockInput = app.querySelector<HTMLInputElement>("#flock")!;
  const flockLabel = app.querySelector("[data-val=\"flock\"]")!;
  flockInput.addEventListener("input", () => {
    flockSize = Number(flockInput.value);
    flockLabel.textContent = String(flockSize);
    seed(flockSize);
  });
  app.querySelector("#reset")?.addEventListener("click", () => seed());
  window.addEventListener("keydown", (event) => {
    if (event.key === "r" && !event.metaKey && !event.ctrlKey) seed();
    if (event.key === " " && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      pulse = 1;
    }
  });

  const camera = perspectiveCamera({
    fov: 48,
    aspect: canvasSurface.size[0]! / Math.max(1, canvasSurface.size[1]!),
    near: 0.2,
    far: 160,
    position: [11.5, 6.2, 13.5],
    target: [0, 2.6, 0],
  });
  const controls = orbitControls(camera, {
    element: canvas,
    target: [0, 2.6, 0],
    damping: 0.08,
    distance: { min: 4, max: 28 },
  });
  const pointer = canvasPointer(canvas);

  const cameraU = uniforms(gpu, {
    viewProjection: camera.viewProjection,
    invViewProjection: invertMat4(camera.viewProjection),
    cameraPos: [camera.position[0]!, camera.position[1]!, camera.position[2]!],
    time: 0,
  });
  const simU = uniforms(gpu, {
    dt: 1 / 60,
    scare: 0,
    time: 0,
    seed: 0,
    mouse: [0, FLOCK_Y, 0],
    minSpeed: 2.4,
    sep,
    align,
    coh,
    maxSpeed,
  });
  const meshU = uniforms(gpu, {
    indexCount,
    _pad0: 0,
    _pad1: 0,
    _pad2: 0,
  });

  const simulate = compute(gpu, boidsShader, {
    label: "boids-sim",
    entry: "simulate",
    set: { src: flock.read, dst: flock.write, sim: simU, counters },
  });
  const resetPacked = compute(gpu, boidsShader, {
    label: "boids-reset",
    entry: "resetPacked",
    set: { counters },
  });
  const compact = compute(gpu, boidsShader, {
    label: "boids-compact",
    entry: "compact",
    set: { src: flock.read, dst: flock.write, counters },
  });
  const counts = compute(gpu, boidsShader, {
    label: "boids-counts",
    entry: "counts",
    set: { counters, dispatchArgs, drawArgs, mesh: meshU },
  });

  const birds = draw(gpu, {
    shader: birdShader,
    geometry: birdGeo,
    cull: "none",
    set: { camera: cameraU, boids: flock.read },
  });
  const ground = draw(gpu, {
    shader: groundShader,
    geometry: groundGeo,
    cull: "none",
    set: { camera: cameraU },
  });
  const sky = draw(gpu, {
    shader: skyShader,
    geometry: skyGeo,
    cull: "front",
    depth: { write: false },
    set: { camera: cameraU },
  });
  const linear = sampler(gpu, { minFilter: "linear", magFilter: "linear" });
  const present = effect(gpu, presentShader, {
    set: {
      scene: sceneTarget,
      sceneSampler: linear,
      present: { exposure: 0.58, _pad0: 0, _pad1: 0, _pad2: 0 },
    },
  });

  canvasSurface.onResize(() => {
    const [width, height] = canvasSurface.size;
    camera.set({ aspect: width / Math.max(1, height) });
    sceneTarget.resize([width, height]);
    present.set({ scene: sceneTarget });
  });

  gpu.onError((error) => {
    readout.textContent = error instanceof Error ? error.message : String(error);
    console.error(error);
  });

  readout.textContent = "compiling…";
  await Promise.all([birds.compile(sceneTarget), ground.compile(sceneTarget), sky.compile(sceneTarget)]);
  readout.textContent = "compiled";

  const time = clock(gpu);
  frameLoop(gpu, (frame) => {
    try {
      controls.update(time.deltaTime);
      pulse = Math.max(0, pulse - time.deltaTime * 2.2);
      if (pointer.down) pulse = Math.max(pulse, 1);
      const invVP = invertMat4(camera.viewProjection);
      const scare = pointer.down ? 1.35 : pointer.ready ? 0.28 : 0;
      const mouse = pointer.ready
        ? unprojectToPlaneY(pointer.position, invVP, FLOCK_Y)
        : ([80, FLOCK_Y, 80] as [number, number, number]);

      cameraU.set({
        viewProjection: camera.viewProjection,
        invViewProjection: invVP,
        cameraPos: [camera.position[0]!, camera.position[1]!, camera.position[2]!],
        time: time.time,
      });
      simU.set({
        dt: Math.min(time.deltaTime, 1 / 30),
        scare: scare + pulse * 1.6,
        time: time.time,
        seed: time.frameCount,
        mouse,
        minSpeed: maxSpeed * 0.48,
        sep,
        align,
        coh,
        maxSpeed,
      });

      simulate.set({ src: flock.read, dst: flock.write, sim: simU, counters });
      simulate.dispatch({ indirect: dispatchArgs });
      flock.swap();

      resetPacked.set({ counters });
      resetPacked.dispatch(1);
      compact.set({ src: flock.read, dst: flock.write, counters });
      compact.dispatch(MAX_GROUPS);
      flock.swap();

      counts.set({ counters, dispatchArgs, drawArgs, mesh: meshU });
      counts.dispatch(1);

      birds.set({ camera: cameraU, boids: flock.read });

      frame.pass({ target: sceneTarget, clear: [0.05, 0.04, 0.08, 1], clearDepth: 1 }, (pass) => {
        pass.draw(sky);
        pass.draw(ground);
        pass.draw(birds, { indirect: drawArgs });
      });
      frame.pass(canvasSurface, present);

      if (!reading && time.frameCount % 24 === 0) {
        reading = true;
        void counters.read().then((buf) => {
          aliveHud = new Uint32Array(buf)[0] ?? 0;
          reading = false;
          if (aliveHud === 0) seed();
        });
      }
      readout.textContent = `${aliveHud} / ${flockSize} birds  ·  compact + indirect`;
    } catch (error) {
      readout.textContent = error instanceof Error ? error.message : String(error);
      console.error(error);
    }
  });
}

main().catch((error) => {
  const app = document.querySelector("#app");
  const message = error instanceof Error ? error.message : String(error);
  if (app) {
    app.innerHTML = `<div class="error"><h1>WebGPU failed</h1><p>${message}</p></div>`;
  }
  console.error(error);
});
