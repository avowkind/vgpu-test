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
  uniforms,
} from "vgpu";
import { orbitControls, perspectiveCamera } from "vgpu/scene";
import blitShader from "./blit.wgsl";
import { DEFAULT_PARAMS, IDENTITY, type HourglassParams } from "./constants";
import glassShader from "./glass.wgsl";
import {
  createChessboard,
  createGlass,
  createHardware,
  createPileTemplate,
  createRoom,
  createTable,
  icosphere,
  STRIDE,
  type Mesh,
} from "./meshes";
import opaqueShader from "./opaque.wgsl";
import presentShader from "./present.wgsl";
import { SandSolver } from "./sand";
import sandShader from "./sand.wgsl";
import "./style.css";

function meshGeometry(
  gpu: Awaited<ReturnType<typeof init>>,
  mesh: Mesh,
  extraName: "material" | "thickness",
) {
  return geometry(gpu, {
    buffers: [
      {
        data: mesh.vertices,
        stride: STRIDE * 4,
        attributes: {
          position: "float32x3",
          normal: { format: "float32x3", offset: 12 },
          uv: { format: "float32x2", offset: 24 },
          [extraName]: { format: "float32", offset: 32 },
        },
      },
    ],
    indices: mesh.indices,
  });
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
    const look = controls.target;
    controls.set({
      target: [
        look[0]! - right[0]! * dx * scale + up[0]! * dy * scale,
        look[1]! - right[1]! * dx * scale + up[1]! * dy * scale,
        look[2]! - right[2]! * dx * scale + up[2]! * dy * scale,
      ],
    });
  };

  const onUp = (event: PointerEvent) => {
    if (!panning) return;
    panning = false;
    canvas.releasePointerCapture(event.pointerId);
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 0) onUserOrbit();
  });
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onUserOrbit, { passive: true });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

function slider(id: string, label: string, min: number, max: number, step: number, value: number): string {
  return `
    <label>
      <span>${label}</span>
      <span data-val="${id}">${value}</span>
      <input type="range" data-param="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
    </label>
  `;
}

async function main() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app missing");

  const params: HourglassParams = { ...DEFAULT_PARAMS };

  app.innerHTML = `
    <canvas id="viewport" aria-label="Hourglass viewport"></canvas>
    <a class="back" href="${import.meta.env.BASE_URL}">All demos</a>
    <aside class="hud">
      <h1>Hourglass</h1>
      <p>Sand drains through uneven soda-lime glass onto a chessboard. Drag to orbit · scroll to zoom · right-drag to pan</p>
    </aside>
    <aside class="panel">
      ${slider("reposeAngle", "repose_angle", 24, 40, 0.5, params.reposeAngle)}
      ${slider("neckRadius", "neck_radius", 0.28, 0.7, 0.01, params.neckRadius)}
      ${slider("grainRadius", "grain_radius", 0.004, 0.03, 0.001, params.grainRadius)}
      ${slider("flowRateScale", "flow_rate_scale", 0.2, 2.5, 0.05, params.flowRateScale)}
      ${slider("glassIor", "glass_ior", 1.4, 1.65, 0.005, params.glassIor)}
      ${slider("thicknessScale", "thickness_scale", 0.4, 2.2, 0.05, params.thicknessScale)}
      ${slider("dispersion", "dispersion", 0, 2.5, 0.05, params.dispersion)}
      ${slider("absorptionDistance", "absorption_distance", 2, 14, 0.2, params.absorptionDistance)}
      ${slider("cameraOrbit", "camera_orbit", 0, 1, 1, params.cameraOrbit)}
      ${slider("sandCount", "sand_count", 400, 4000, 50, params.sandCount)}
    </aside>
  `;

  const canvas = document.querySelector<HTMLCanvasElement>("#viewport")!;
  for (const input of app.querySelectorAll<HTMLInputElement>("[data-param]")) {
    input.addEventListener("input", () => {
      const key = input.dataset.param as keyof HourglassParams;
      params[key] = Number(input.value);
      const label = app.querySelector(`[data-val="${key}"]`);
      if (label) label.textContent = String(params[key]);
    });
  }

  const gpu = await init();
  const canvasSurface = surface(gpu, canvas, { dpr: [1, 2] });
  const sceneTarget = target(gpu, {
    size: canvasSurface.size,
    format: "rgba16float",
    depth: true,
  });
  const refraction = target(gpu, {
    size: canvasSurface.size,
    format: "rgba16float",
  });

  const boardMesh = createChessboard();
  const tableMesh = createTable();
  const roomMesh = createRoom();
  const hardwareMesh = createHardware();
  const glassMesh = createGlass();
  const pileMesh = createPileTemplate();
  const grainMesh = icosphere(1, 0);

  const boardGeo = meshGeometry(gpu, boardMesh, "material");
  const tableGeo = meshGeometry(gpu, tableMesh, "material");
  const roomGeo = meshGeometry(gpu, roomMesh, "material");
  const hardwareGeo = meshGeometry(gpu, hardwareMesh, "material");
  const glassGeo = meshGeometry(gpu, glassMesh, "thickness");
  const pileUpperGeo = meshGeometry(gpu, {
    vertices: new Float32Array(pileMesh.vertices),
    indices: pileMesh.indices,
  }, "material");
  const pileLowerGeo = meshGeometry(gpu, {
    vertices: new Float32Array(pileMesh.vertices),
    indices: pileMesh.indices,
  }, "material");

  const instanceData = new Float32Array(4096 * 8);
  const grainGeo = geometry(gpu, {
    buffers: [
      {
        data: grainMesh.vertices,
        stride: STRIDE * 4,
        attributes: {
          position: "float32x3",
          normal: { format: "float32x3", offset: 12 },
        },
      },
      {
        stepMode: "instance",
        data: instanceData,
        stride: 32,
        attributes: {
          iPos: "float32x4",
          iColor: { format: "float32x4", offset: 16 },
        },
      },
    ],
    indices: grainMesh.indices,
  });

  const sand = new SandSolver(pileMesh.vertices.length);
  sand.step(0, params);

  const camera = perspectiveCamera({
    fov: 40,
    aspect: canvasSurface.size[0]! / Math.max(1, canvasSurface.size[1]!),
    near: 0.4,
    far: 280,
    position: [24, 26, 52],
    target: [0, 8, 0],
  });

  const controls = orbitControls(camera, {
    element: canvas,
    target: [0, 8, 0],
    damping: 0.08,
    distance: { min: 28, max: 140 },
  });

  let userOrbit = false;
  const baseYaw = Math.atan2(camera.position[0]! - 0, camera.position[2]! - 0);

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
      userOrbit = true;
    },
  );

  const cameraU = uniforms(gpu, {
    viewProjection: camera.viewProjection,
    cameraPos: [camera.position[0]!, camera.position[1]!, camera.position[2]!],
    time: 0,
  });

  const opaqueDraw = (geo: ReturnType<typeof geometry>) =>
    draw(gpu, {
      shader: opaqueShader,
      geometry: geo,
      cull: "back",
      set: { camera: cameraU, model: { model: IDENTITY } },
    });

  const board = draw(gpu, {
    shader: opaqueShader,
    geometry: boardGeo,
    cull: "none",
    set: { camera: cameraU, model: { model: IDENTITY } },
  });
  const table = opaqueDraw(tableGeo);
  const room = draw(gpu, {
    shader: opaqueShader,
    geometry: roomGeo,
    cull: "none",
    set: { camera: cameraU, model: { model: IDENTITY } },
  });
  const hardware = draw(gpu, {
    shader: opaqueShader,
    geometry: hardwareGeo,
    cull: "none",
    set: { camera: cameraU, model: { model: IDENTITY } },
  });
  const pileUpper = draw(gpu, {
    shader: opaqueShader,
    geometry: pileUpperGeo,
    cull: "none",
    set: { camera: cameraU, model: { model: IDENTITY } },
  });
  const pileLower = draw(gpu, {
    shader: opaqueShader,
    geometry: pileLowerGeo,
    cull: "none",
    set: { camera: cameraU, model: { model: IDENTITY } },
  });

  const grains = draw(gpu, {
    shader: sandShader,
    geometry: grainGeo,
    cull: "back",
    set: { camera: cameraU },
  });

  const linear = sampler(gpu, { minFilter: "linear", magFilter: "linear" });
  const nearest = sampler(gpu, { minFilter: "nearest", magFilter: "nearest" });

  const blit = effect(gpu, blitShader, {
    set: { scene: sceneTarget, sceneSampler: nearest },
  });

  const glass = draw(gpu, {
    shader: glassShader,
    geometry: glassGeo,
    cull: "back",
    depth: { write: false },
    blend: "alpha",
    set: {
      camera: cameraU,
      glass: {
        ior: params.glassIor,
        thicknessScale: params.thicknessScale,
        dispersion: params.dispersion,
        absorption: params.absorptionDistance,
      },
      sceneTex: refraction,
      sceneSampler: linear,
    },
  });

  const present = effect(gpu, presentShader, {
    set: {
      scene: sceneTarget,
      sceneSampler: linear,
      sceneDepth: sceneTarget.depth,
      present: {
        focus: 0.42,
        texelX: sceneTarget.texelSize[0],
        texelY: sceneTarget.texelSize[1],
        _pad: 0,
      },
    },
  });

  canvasSurface.onResize(() => {
    const [width, height] = canvasSurface.size;
    camera.set({ aspect: width / Math.max(1, height) });
    sceneTarget.resize([width, height]);
    refraction.resize([width, height]);
    blit.set({ scene: sceneTarget });
    glass.set({ sceneTex: refraction });
    present.set({
      scene: sceneTarget,
      sceneDepth: sceneTarget.depth,
      present: { texelX: sceneTarget.texelSize[0], texelY: sceneTarget.texelSize[1] },
    });
  });

  await Promise.all([
    board.compile(sceneTarget),
    table.compile(sceneTarget),
    room.compile(sceneTarget),
    hardware.compile(sceneTarget),
    pileUpper.compile(sceneTarget),
    pileLower.compile(sceneTarget),
    grains.compile(sceneTarget),
    glass.compile(sceneTarget),
    blit.compile(refraction),
  ]);

  const time = clock(gpu);
  frameLoop(gpu, (frame) => {
    sand.step(Math.min(time.deltaTime, 0.05), params);

    pileUpperGeo.write(sand.pileUpper);
    pileLowerGeo.write(sand.pileLower);
    grainGeo.buffers[1]!.write(sand.instances);

    if (!userOrbit && params.cameraOrbit > 0.5) {
      const yaw = baseYaw + Math.sin(time.time * (Math.PI * 2) / 16) * (15 * Math.PI / 180);
      const dist = controls.distance;
      const pitch = controls.pitch;
      controls.set({
        yaw,
        pitch,
        distance: dist,
        target: [0, 8, 0],
      });
    }
    controls.update(time.deltaTime);

    cameraU.set({
      viewProjection: camera.viewProjection,
      cameraPos: [camera.position[0]!, camera.position[1]!, camera.position[2]!],
      time: time.time,
    });
    glass.set({
      glass: {
        ior: params.glassIor,
        thicknessScale: params.thicknessScale,
        dispersion: params.dispersion,
        absorption: params.absorptionDistance,
      },
    });

    frame.pass(
      { target: sceneTarget, clear: [0.07, 0.075, 0.09, 1], clearDepth: 1 },
      (pass) => {
        pass.draw(room);
        pass.draw(table);
        pass.draw(board);
        pass.draw(hardware);
        pass.draw(pileLower);
        pass.draw(pileUpper);
        if (sand.instanceCount > 0) pass.draw(grains, { instances: sand.instanceCount });
      },
    );
    frame.pass(refraction, blit);
    frame.pass({ target: sceneTarget, clear: false }, (pass) => {
      pass.draw(glass);
    });
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
