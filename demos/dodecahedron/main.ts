import {
  clock,
  draw,
  effect,
  frameLoop,
  geometry,
  init,
  sampler,
  surface,
  target,
} from "vgpu";
import { orbitControls, perspectiveCamera } from "vgpu/scene";
import { createColoredDodecahedron } from "./colored-dodecahedron";
import objectShader from "./object.wgsl";
import presentShader from "./present.wgsl";
import "./style.css";

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function installPan(
  canvas: HTMLCanvasElement,
  controls: ReturnType<typeof orbitControls>,
  getCameraAxes: () => { right: Float32Array; up: Float32Array },
) {
  let panning = false;
  let lastX = 0;
  let lastY = 0;

  const onDown = (event: PointerEvent) => {
    // Right or middle mouse pans (orbit uses left button).
    if (event.button !== 1 && event.button !== 2) return;
    event.preventDefault();
    panning = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };

  const onMove = (event: PointerEvent) => {
    if (!panning) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    const { right, up } = getCameraAxes();
    const scale = controls.distance * 0.00175;
    const target = controls.target;
    controls.set({
      target: [
        target[0]! - right[0]! * dx * scale + up[0]! * dy * scale,
        target[1]! - right[1]! * dx * scale + up[1]! * dy * scale,
        target[2]! - right[2]! * dx * scale + up[2]! * dy * scale,
      ],
    });
  };

  const onUp = (event: PointerEvent) => {
    if (!panning) return;
    panning = false;
    canvas.releasePointerCapture(event.pointerId);
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
  };
}

async function main() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app missing");

  app.innerHTML = `
    <canvas id="viewport" aria-label="Dodecahedron viewport"></canvas>
    <a class="back" href="${import.meta.env.BASE_URL}">All demos</a>
    <aside class="hud">
      <h1>Dodecahedron</h1>
      <p>Drag to rotate · scroll to zoom · right-drag to pan</p>
    </aside>
  `;

  const canvas = document.querySelector<HTMLCanvasElement>("#viewport")!;
  const gpu = await init();
  const canvasSurface = surface(gpu, canvas, { dpr: [1, 2] });

  const sceneTarget = target(gpu, {
    size: canvasSurface.size,
    depth: true,
  });

  const mesh = createColoredDodecahedron(1);
  const geo = geometry(gpu, {
    buffers: [
      {
        data: mesh.vertices,
        stride: 36,
        attributes: {
          position: "float32x3",
          normal: { format: "float32x3", offset: 12 },
          color: { format: "float32x3", offset: 24 },
        },
      },
    ],
    indices: mesh.indices,
  });

  const camera = perspectiveCamera({
    fov: 42,
    aspect: canvasSurface.size[0]! / Math.max(1, canvasSurface.size[1]!),
    near: 0.1,
    far: 100,
    position: [2.4, 1.6, 3.2],
    target: [0, 0, 0],
  });

  const controls = orbitControls(camera, {
    element: canvas,
    damping: 0.08,
    distance: { min: 1.4, max: 12 },
  });

  installPan(canvas, controls, () => {
    const view = camera.view;
    // wgpu-matrix / column-major view: right = row0 of inverse ≈ columns of view transposed
    return {
      right: new Float32Array([view[0]!, view[4]!, view[8]!]),
      up: new Float32Array([view[1]!, view[5]!, view[9]!]),
    };
  });

  const shape = draw(gpu, {
    shader: objectShader,
    geometry: geo,
    cull: "back",
  });
  shape.set({
    camera: { viewProjection: camera.viewProjection },
    model: { model: IDENTITY },
  });

  const linear = sampler(gpu, { minFilter: "linear", magFilter: "linear" });
  const present = effect(gpu, presentShader, {
    set: { scene: sceneTarget, sceneSampler: linear },
  });

  canvasSurface.onResize(() => {
    const [width, height] = canvasSurface.size;
    camera.set({ aspect: width / Math.max(1, height) });
    sceneTarget.resize([width, height]);
    present.set({ scene: sceneTarget });
  });

  const time = clock(gpu);
  frameLoop(gpu, (frame) => {
    controls.update(time.deltaTime);
    // draw.set() packs uniforms immediately — re-upload after the camera moves.
    shape.set({ camera: { viewProjection: camera.viewProjection } });
    frame.pass(
      { target: sceneTarget, clear: [0.06, 0.07, 0.1, 1], clearDepth: 1 },
      (pass) => {
        pass.draw(shape);
      },
    );
    frame.pass(canvasSurface, present);
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
