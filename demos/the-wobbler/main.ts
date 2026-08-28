import { clock, effect, frameLoop, init, surface } from "vgpu";
import { orbitControls, perspectiveCamera } from "vgpu/scene";
import wobbleSource from "./wobble.wgsl";
import "./style.css";

const AMPLITUDE = 4.6;
const OMEGA = 0.21;
const BALL_SPIN = 1.85; // rad/s about core axis (+X)
const RING_SPIN = -0.064; // opposite, ~20% of prior spin
/** Match wobble.wgsl ring ribbon — sit just inside the inner face. */
const RING_MAJOR = 4.3;
const RING_BAND = 0.28;
const INNER_STAND_OFF = 0.18;

type SyncMode = "free" | "ball" | "ring" | "inner";

function ballCenter(t: number): [number, number, number] {
  const phase = t * OMEGA;
  const x = AMPLITUDE * Math.cos(phase);
  const wobble = 0.07;
  const y = wobble * Math.sin(phase * 2.0 + 0.7) + 0.02 * Math.sin(phase * 5.1 + 1.2);
  const z = wobble * 0.7 * Math.sin(phase * 2.0 - 0.35) + 0.015 * Math.cos(phase * 4.3);
  return [x, y, z];
}

function installPan(
  canvas: HTMLCanvasElement,
  controls: ReturnType<typeof orbitControls>,
  getCameraAxes: () => { right: Float32Array; up: Float32Array },
  onUserOrbit: () => void,
) {
  let panning = false;
  let lastX = 0;
  let lastY = 0;

  const onDown = (event: PointerEvent) => {
    if (event.button !== 1 && event.button !== 2) return;
    event.preventDefault();
    panning = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    onUserOrbit();
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

  const onLeftDown = (event: PointerEvent) => {
    if (event.button === 0) onUserOrbit();
  };

  const onWheel = () => onUserOrbit();

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerdown", onLeftDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: true });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

async function main() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app missing");

  app.innerHTML = `
    <canvas id="viewport" aria-label="The Wobbler viewport"></canvas>
    <a class="back" href="/">All demos</a>
    <aside class="hud">
      <h1>The Wobbler</h1>
      <p>Alien ringworld propulsion at ~1 AU — drag to orbit · scroll to zoom · right-drag to pan</p>
      <div class="sync" role="group" aria-label="Camera sync">
        <button type="button" data-sync="ball">Sync to mass</button>
        <button type="button" data-sync="ring">Sync to ring</button>
        <button type="button" data-sync="inner">Inner surface</button>
        <button type="button" data-sync="free" class="active">Free cam</button>
      </div>
      <div class="sync" role="group" aria-label="Mass mode">
        <button type="button" data-mass="metal">Metal mass</button>
        <button type="button" data-mass="plasma" class="active">Plasma sun</button>
      </div>
    </aside>
  `;

  const canvas = document.querySelector<HTMLCanvasElement>("#viewport")!;
  const syncButtons = [...app.querySelectorAll<HTMLButtonElement>("[data-sync]")];
  const massButtons = [...app.querySelectorAll<HTMLButtonElement>("[data-mass]")];
  let syncMode: SyncMode = "free";
  let plasmaSun = true;

  const setSyncMode = (mode: SyncMode) => {
    syncMode = mode;
    for (const button of syncButtons) {
      button.classList.toggle("active", button.dataset.sync === mode);
    }
  };

  const setMassMode = (mode: "metal" | "plasma") => {
    plasmaSun = mode === "plasma";
    for (const button of massButtons) {
      button.classList.toggle("active", button.dataset.mass === mode);
    }
  };

  for (const button of syncButtons) {
    button.addEventListener("click", () => {
      setSyncMode((button.dataset.sync as SyncMode) ?? "free");
    });
  }

  for (const button of massButtons) {
    button.addEventListener("click", () => {
      setMassMode(button.dataset.mass === "plasma" ? "plasma" : "metal");
    });
  }

  const gpu = await init();
  const canvasSurface = surface(gpu, canvas, { dpr: [1, 2] });
  const time = clock(gpu);

  const camera = perspectiveCamera({
    fov: 42,
    aspect: canvasSurface.size[0]! / Math.max(1, canvasSurface.size[1]!),
    near: 0.1,
    far: 200,
    position: [7.2, 2.4, 6.1],
    target: [0, 0.05, 0],
  });

  const controls = orbitControls(camera, {
    element: canvas,
    damping: 0.08,
    distance: { min: 0.55, max: 28 },
  });

  installPan(
    canvas,
    controls,
    () => {
      const view = camera.view;
      return {
        right: new Float32Array([view[0]!, view[4]!, view[8]!]),
        up: new Float32Array([view[1]!, view[5]!, view[9]!]),
      };
    },
    () => {
      if (syncMode !== "free") setSyncMode("free");
    },
  );

  const wobble = effect(gpu, wobbleSource, {
    set: {
      params: {
        time: 0,
        aspect: canvasSurface.size[0]! / Math.max(1, canvasSurface.size[1]!),
        ringAngle: 0,
        ballSpin: 0,
        cameraPos: [camera.position[0]!, camera.position[1]!, camera.position[2]!, 0],
        cameraForward: [0, 0, -1, 0],
        cameraRight: [1, 0, 0, 0],
        cameraUp: [0, 1, 0, 0],
        ballPos: [AMPLITUDE, 0, 0, 1],
      },
    },
  });

  canvasSurface.onResize(() => {
    const [width, height] = canvasSurface.size;
    camera.set({ aspect: width / Math.max(1, height) });
    wobble.set({
      params: { aspect: width / Math.max(1, height) },
    });
  });

  frameLoop(gpu, (frame) => {
    const t = time.time;
    const ball = ballCenter(t);
    const ringAngle = t * RING_SPIN;
    const ballSpin = t * BALL_SPIN;

    if (syncMode === "ball") {
      // Follow transit on X only — ignore off-axis wobble so look direction stays locked.
      camera.set({ fov: 42 });
      controls.set({ target: [ball[0], 0.05, 0] });
      controls.update(time.deltaTime);
    } else if (syncMode === "ring") {
      camera.set({ fov: 42 });
      controls.set({ target: [0, 0.05, 0] });
      controls.update(time.deltaTime);
    } else if (syncMode === "inner") {
      // Ride the inner face of the spinning ribbon; look across the aperture.
      const r = RING_MAJOR - RING_BAND - INNER_STAND_OFF;
      const camY = r * Math.cos(ringAngle);
      const camZ = r * Math.sin(ringAngle);
      const target: [number, number, number] = [0, 0.05, 0];
      const ox = 0 - target[0];
      const oy = camY - target[1];
      const oz = camZ - target[2];
      const len = Math.hypot(ox, oy, oz) || 1;
      controls.set({
        target,
        distance: len,
        yaw: Math.atan2(ox, oz),
        pitch: Math.asin(Math.max(-1, Math.min(1, oy / len))),
      });
      camera.set({ position: [0, camY, camZ], fov: 72 });
      camera.lookAt(target);
    } else {
      camera.set({ fov: 42 });
      controls.update(time.deltaTime);
    }

    // View-matrix rows = camera axes in world space (orientation only).
    const view = camera.view;
    const right: [number, number, number] = [view[0]!, view[4]!, view[8]!];
    const up: [number, number, number] = [view[1]!, view[5]!, view[9]!];
    const forward: [number, number, number] = [-view[2]!, -view[6]!, -view[10]!];

    wobble.set({
      params: {
        time: t,
        ringAngle,
        ballSpin,
        cameraPos: [camera.position[0]!, camera.position[1]!, camera.position[2]!, 0],
        cameraForward: [...forward, 0],
        cameraRight: [...right, 0],
        cameraUp: [...up, 0],
        ballPos: [ball[0], ball[1], ball[2], plasmaSun ? 1 : 0],
      },
    });
    frame.pass(canvasSurface, wobble);
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
