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
import { createDial } from "./dial";
import depthShader from "./depth.wgsl";
import {
  AUCKLAND,
  CITIES,
  civilTime,
  cityForTimeZone,
  cityToPlace,
  defaultPlace,
  formatClock,
  loadSavedPlace,
  matchCities,
  placeFromGeolocation,
  savePlace,
} from "./location";
import {
  addSkyCube,
  createCourt,
  createPedestal,
  STRIDE,
  type Mesh,
} from "./meshes";
import opaqueShader from "./opaque.wgsl";
import presentShader from "./present.wgsl";
import { createLightCamera, fitLightCamera, invertMat4 } from "./shadow";
import skyShader from "./sky.wgsl";
import { formatSolarTime, sunAt } from "./sun";
import "./style.css";

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const SHADOW_SIZE = 2048;
const DIAL_VERT_CAP = 90_000;
const DIAL_INDEX_CAP = 180_000;

function meshGeometry(gpu: Awaited<ReturnType<typeof init>>, mesh: Mesh) {
  return geometry(gpu, {
    buffers: [
      {
        data: mesh.vertices,
        stride: STRIDE * 4,
        attributes: {
          position: "float32x3",
          normal: { format: "float32x3", offset: 12 },
          uv: { format: "float32x2", offset: 24 },
          material: { format: "float32", offset: 32 },
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
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

function defaultCameraPosition(lat: number): [number, number, number] {
  const north = lat < 0;
  return north ? [1.55, 1.32, 2.7] : [1.55, 1.32, -2.7];
}

async function main() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app missing");

  let place = loadSavedPlace();
  let hourOffset = 0;
  let dayOffset = 0;
  let status = "";
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zoneHint = cityForTimeZone(browserZone);

  app.innerHTML = `
    <canvas id="viewport" aria-label="Sundial viewport"></canvas>
    <a class="back" href="${import.meta.env.BASE_URL}">All demos</a>
    <aside class="hud">
      <h1>Sundial</h1>
      <p data-copy>Auckland — the shadow is apparent solar time. Drag to orbit · scroll to zoom · right-drag to pan</p>
    </aside>
    <aside class="panel">
      <label class="stack">
        <span>City</span>
        <input type="search" id="city" autocomplete="off" placeholder="Auckland" value="${place.label}" />
      </label>
      <ul class="suggest" id="suggest" hidden></ul>
      <div class="row">
        <button type="button" id="geo">Use my location</button>
        <button type="button" id="auckland">Auckland</button>
      </div>
      ${zoneHint && zoneHint.id !== "auckland" ? `<button type="button" class="ghost" id="tz-hint">Use ${zoneHint.name}</button>` : ""}
      <label>
        <span>hour_offset</span>
        <span data-val="hour">0</span>
        <input type="range" id="hour" min="-12" max="12" step="0.1" value="0" />
      </label>
      <label>
        <span>day_offset</span>
        <span data-val="day">0</span>
        <input type="range" id="day" min="-182" max="182" step="1" value="0" />
      </label>
      <button type="button" id="now">Now</button>
      <p class="readout" id="readout"></p>
    </aside>
  `;

  const canvas = document.querySelector<HTMLCanvasElement>("#viewport")!;
  const cityInput = app.querySelector<HTMLInputElement>("#city")!;
  const suggest = app.querySelector<HTMLUListElement>("#suggest")!;
  const readout = app.querySelector<HTMLParagraphElement>("#readout")!;
  const copy = app.querySelector<HTMLParagraphElement>("[data-copy]")!;
  const hourSlider = app.querySelector<HTMLInputElement>("#hour")!;
  const daySlider = app.querySelector<HTMLInputElement>("#day")!;

  const renderSuggest = (query: string) => {
    const matches = matchCities(query);
    suggest.innerHTML = matches
      .map(
        (city) =>
          `<li><button type="button" data-city="${city.id}">${city.name}<span>${city.country}</span></button></li>`,
      )
      .join("");
    suggest.hidden = matches.length === 0;
  };

  cityInput.addEventListener("focus", () => renderSuggest(cityInput.value));
  cityInput.addEventListener("input", () => renderSuggest(cityInput.value));
  cityInput.addEventListener("blur", () => {
    window.setTimeout(() => {
      suggest.hidden = true;
    }, 180);
  });
  suggest.addEventListener("mousedown", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-city]");
    if (!button) return;
    const id = button.dataset.city;
    const city = CITIES.find((entry) => entry.id === id);
    if (!city) return;
    place = cityToPlace(city);
    cityInput.value = city.name;
    savePlace(place);
    suggest.hidden = true;
  });

  app.querySelector("#auckland")?.addEventListener("click", () => {
    place = defaultPlace();
    cityInput.value = AUCKLAND.name;
    savePlace(place);
  });
  app.querySelector("#tz-hint")?.addEventListener("click", () => {
    if (!zoneHint) return;
    place = cityToPlace(zoneHint);
    cityInput.value = zoneHint.name;
    savePlace(place);
  });
  app.querySelector("#geo")?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      status = "Geolocation is not available";
      return;
    }
    status = "Locating…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        place = placeFromGeolocation(
          pos.coords.latitude,
          pos.coords.longitude,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
        cityInput.value = place.label;
        savePlace(place);
        status = "";
      },
      (error) => {
        status = error.message || "Location denied";
      },
    );
  });

  const resetTime = () => {
    hourOffset = 0;
    dayOffset = 0;
    hourSlider.value = "0";
    daySlider.value = "0";
    app.querySelector('[data-val="hour"]')!.textContent = "0";
    app.querySelector('[data-val="day"]')!.textContent = "0";
  };
  app.querySelector("#now")?.addEventListener("click", resetTime);
  window.addEventListener("keydown", (event) => {
    if (event.key === "n" && !event.metaKey && !event.ctrlKey && document.activeElement !== cityInput) {
      resetTime();
    }
  });
  hourSlider.addEventListener("input", () => {
    hourOffset = Number(hourSlider.value);
    app.querySelector('[data-val="hour"]')!.textContent = String(hourOffset);
  });
  daySlider.addEventListener("input", () => {
    dayOffset = Number(daySlider.value);
    app.querySelector('[data-val="day"]')!.textContent = String(dayOffset);
  });

  const gpu = await init();
  const canvasSurface = surface(gpu, canvas, { dpr: [1, 2] });
  const sceneTarget = target(gpu, {
    size: canvasSurface.size,
    format: "rgba16float",
    depth: true,
  });
  const shadowTarget = target(gpu, {
    size: [SHADOW_SIZE, SHADOW_SIZE],
    format: "rgba8unorm",
    depth: true,
  });

  const courtMesh = createCourt();
  const pedestalMesh = createPedestal();
  const skyMesh = addSkyCube(90);
  const courtGeo = meshGeometry(gpu, courtMesh);
  const pedestalGeo = meshGeometry(gpu, pedestalMesh);
  const skyGeo = meshGeometry(gpu, skyMesh);

  const firstDial = createDial((place.lat * Math.PI) / 180);
  const dialVerts = new Float32Array(DIAL_VERT_CAP * STRIDE);
  const dialIdx = new Uint32Array(DIAL_INDEX_CAP);
  dialVerts.set(firstDial.mesh.vertices);
  dialIdx.set(firstDial.mesh.indices);
  const dialGeo = geometry(gpu, {
    buffers: [
      {
        data: dialVerts,
        stride: STRIDE * 4,
        attributes: {
          position: "float32x3",
          normal: { format: "float32x3", offset: 12 },
          uv: { format: "float32x2", offset: 24 },
          material: { format: "float32", offset: 32 },
        },
      },
    ],
    indices: dialIdx,
  });
  let dialIndexCount = firstDial.mesh.indices.length;
  let lastPhi = firstDial.phi;

  const uploadDial = (phi: number) => {
    if (Math.abs(phi - lastPhi) < 0.0005) return;
    const next = createDial(phi);
    if (next.mesh.vertices.length > dialVerts.length || next.mesh.indices.length > dialIdx.length) {
      throw new Error("Dial mesh exceeded buffer cap");
    }
    dialVerts.fill(0);
    dialIdx.fill(0);
    dialVerts.set(next.mesh.vertices);
    dialIdx.set(next.mesh.indices);
    dialGeo.write(dialVerts);
    dialGeo.writeIndices(dialIdx);
    dialIndexCount = next.mesh.indices.length;
    lastPhi = phi;
  };

  const startPos = defaultCameraPosition(place.lat);
  const camera = perspectiveCamera({
    fov: 42,
    aspect: canvasSurface.size[0]! / Math.max(1, canvasSurface.size[1]!),
    near: 0.12,
    far: 140,
    position: startPos,
    target: [0, 0.02, 0],
  });
  const controls = orbitControls(camera, {
    element: canvas,
    target: [0, 0.02, 0],
    damping: 0.08,
    distance: { min: 1.35, max: 11 },
  });
  installPan(canvas, controls, () => {
    const view = camera.view;
    return {
      right: new Float32Array([view[0]!, view[4]!, view[8]!]),
      up: new Float32Array([view[1]!, view[5]!, view[9]!]),
    };
  });

  const lightCam = createLightCamera();
  const cameraU = uniforms(gpu, {
    viewProjection: camera.viewProjection,
    invViewProjection: invertMat4(camera.viewProjection),
    cameraPos: [camera.position[0]!, camera.position[1]!, camera.position[2]!],
    time: 0,
  });
  const sunU = uniforms(gpu, {
    lightViewProjection: lightCam.viewProjection,
    direction: [0, 1, 0],
    intensity: 0,
    color: [1, 0.94, 0.82],
    bias: 0.0016,
    ambient: [0.16, 0.2, 0.28],
    mapSize: SHADOW_SIZE,
  });
  const lightU = uniforms(gpu, { viewProjection: lightCam.viewProjection });
  const modelU = uniforms(gpu, { model: IDENTITY });

  const opaqueOpts = {
    shader: opaqueShader,
    cull: "back" as const,
    set: { camera: cameraU, model: modelU, sun: sunU, shadowMap: shadowTarget.depth },
  };
  const court = draw(gpu, { ...opaqueOpts, geometry: courtGeo, cull: "none" });
  const pedestal = draw(gpu, { ...opaqueOpts, geometry: pedestalGeo });
  const dial = draw(gpu, { ...opaqueOpts, geometry: dialGeo, cull: "none" });
  const sky = draw(gpu, {
    shader: skyShader,
    geometry: skyGeo,
    cull: "front",
    depth: { write: false },
    set: { camera: cameraU, sun: sunU },
  });

  const depthOpts = {
    shader: depthShader,
    cull: "none" as const,
    depth: { bias: 2, biasSlopeScale: 2.5 },
    set: { light: lightU, model: modelU },
  };
  const courtDepth = draw(gpu, { ...depthOpts, geometry: courtGeo });
  const pedestalDepth = draw(gpu, { ...depthOpts, geometry: pedestalGeo });
  const dialDepth = draw(gpu, { ...depthOpts, geometry: dialGeo });

  const linear = sampler(gpu, { minFilter: "linear", magFilter: "linear" });
  const present = effect(gpu, presentShader, {
    set: {
      scene: sceneTarget,
      sceneSampler: linear,
      present: { exposure: 0.55, _pad0: 0, _pad1: 0, _pad2: 0 },
    },
  });

  canvasSurface.onResize(() => {
    const [width, height] = canvasSurface.size;
    camera.set({ aspect: width / Math.max(1, height) });
    sceneTarget.resize([width, height]);
    present.set({ scene: sceneTarget });
    court.set({ shadowMap: shadowTarget.depth });
    pedestal.set({ shadowMap: shadowTarget.depth });
    dial.set({ shadowMap: shadowTarget.depth });
  });

  await Promise.all([
    court.compile(sceneTarget),
    pedestal.compile(sceneTarget),
    dial.compile(sceneTarget),
    sky.compile(sceneTarget),
    courtDepth.compile(shadowTarget),
    pedestalDepth.compile(shadowTarget),
    dialDepth.compile(shadowTarget),
  ]);

  let lastHemisphere = place.lat < 0 ? -1 : 1;
  const time = clock(gpu);
  frameLoop(gpu, (frame) => {
    const instant = new Date(Date.now() + hourOffset * 3_600_000 + dayOffset * 86_400_000);
    const phi = (place.lat * Math.PI) / 180;
    uploadDial(phi);
    const hemi = place.lat < 0 ? -1 : 1;
    if (hemi !== lastHemisphere) {
      const pos = defaultCameraPosition(place.lat);
      controls.set({
        target: [0, 0.02, 0],
        distance: controls.distance,
        yaw: Math.atan2(pos[0] - 0, pos[2] - 0),
      });
      lastHemisphere = hemi;
    }

    const sun = sunAt(instant, place.lat, place.lon);
    const civil = civilTime(instant, place.timeZone);
    const altDeg = (sun.altitude * 180) / Math.PI;
    const azDeg = (((sun.azimuth * 180) / Math.PI) + 360) % 360;
    const nightNote =
      sun.altitude <= 0
        ? `Night — sun ${Math.abs(altDeg).toFixed(0)}° below the horizon`
        : `alt ${altDeg.toFixed(1)}° · az ${azDeg.toFixed(0)}°`;
    copy.textContent = `${place.label} — the shadow is apparent solar time. Drag to orbit · scroll to zoom · right-drag to pan`;
    readout.textContent = [
      `${formatClock(civil.hour, civil.minute, civil.second)} ${civil.timeZoneName}`,
      `solar ${formatSolarTime(sun.lastHours)}  (EoT ${sun.eotMinutes >= 0 ? "+" : ""}${sun.eotMinutes.toFixed(1)} min)`,
      nightNote,
      `${place.lat.toFixed(2)}°, ${place.lon.toFixed(2)}°`,
      status,
    ]
      .filter(Boolean)
      .join("\n");

    controls.update(time.deltaTime);
    if (sun.aboveHorizon) fitLightCamera(lightCam, sun.direction);

    const ambientScale = sun.aboveHorizon ? 1 : 0.45;
    cameraU.set({
      viewProjection: camera.viewProjection,
      invViewProjection: invertMat4(camera.viewProjection),
      cameraPos: [camera.position[0]!, camera.position[1]!, camera.position[2]!],
      time: time.time,
    });
    lightU.set({ viewProjection: lightCam.viewProjection });
    sunU.set({
      lightViewProjection: lightCam.viewProjection,
      direction: [...sun.direction],
      intensity: sun.intensity,
      color: [...sun.color],
      bias: 0.0016,
      ambient: [0.14 * ambientScale, 0.18 * ambientScale, 0.26 * ambientScale],
      mapSize: SHADOW_SIZE,
    });

    if (sun.aboveHorizon) {
      frame.pass({ target: shadowTarget, clear: [0, 0, 0, 1], clearDepth: 1 }, (pass) => {
        pass.draw(courtDepth);
        pass.draw(pedestalDepth);
        pass.draw(dialDepth, { indices: dialIndexCount });
      });
    }
    frame.pass({ target: sceneTarget, clear: [0.02, 0.03, 0.05, 1], clearDepth: 1 }, (pass) => {
      pass.draw(sky);
      pass.draw(court);
      pass.draw(pedestal);
      pass.draw(dial, { indices: dialIndexCount });
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
