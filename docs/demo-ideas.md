# Demo ideas

Candidate demos for this playground. They avoid duplicating the local set (Dodecahedron, The Wobbler, Hourglass) and the official [vgpu gallery](https://vgpu.sh) (fluids, FFT oceans, radiance cascades, black holes, Earth, glass transmission, fractals, ML/ONNX, instancing, clipping, AA, env maps).

Skip another glass/refraction piece, another fullscreen raymarch, another particle drain, and anything that is basically Earth / ocean / fluid / radiance cascades with different art.

- [ ] **Mechanical orrery** — Nested brass rings, moons, and a pendulum, driven by `scene()` / `group()` / `mesh()` transforms, `lambertMaterial`, and `directionalLight`. This project never uses the scene tree or built-in materials (everything is custom WGSL), and the gallery’s Earth demo is a planet shader, not a hierarchical mechanism.

- [ ] **Clay sculpt (mesh edit)** — Start from a `torus` or `capsule`, then live `extrude` / `bevel` / `loopCut` / `subdivideFaces` from `@vgpu/render/edit`, with a `wireframeMaterial` overlay from `@vgpu/render/inspect`. The whole edit package is unused in both this repo and the gallery.

- [ ] **Crowded colonnade (occlusion culling)** — A dense interior of pillars, statues, and hanging lamps. Cheap proxy boxes are queried with `visibility()`; confirmed-hidden meshes skip the expensive draw next frame. Nothing in the gallery uses occlusion queries.

- [ ] **Reaction-diffusion coral** — Gray–Scott on `pingPong()` targets, then the growing pattern mapped onto a shell or projected as a living surface. Distinct from Interactive Fluid (Navier–Stokes dye) and from Hourglass (grain DEM). Showcases ping-pong targets, which none of the local demos use.

- [x] **Murmuration** — GPU boids in `pingPongStorage` + `compute()`, with `dispatch({ indirect })` so flock size can compact. Instanced birds/fish, not the gallery’s 125k cube lattice and not Hourglass sand. Pointer via `canvasMouseTracker` to scatter the flock.

- [ ] **Draped still-life** — Verlet cloth in compute, hanging over a table of unused primitives (`cone`, `cylinder`, `capsule`, `icosphere`). Same “object on a table” mood as Hourglass, but cloth instead of granular flow, and no glass/transmission (already covered by Transmission, Glass Fractal, and Hourglass).

- [ ] **Voronoi geode** — Crack open a rock; the interior is `voronoi3d` crystals with `f2 - f1` ridges and per-cell IDs. `@vgpu/wgsl-std/noise` is unused here; the gallery fractals are Sierpiński / morphing glass, not cellular noise.

- [ ] **Orthographic cabinet** — Tiny wunderkammer / isometric room: `orthographicCamera`, scene primitives, lambert + ambient lights, slow turntable. Every local demo is perspective + orbit. Reads as a different visual language, not a second dodecahedron.

- [ ] **Sundial with shadow maps** — A gnomon on a marked disk; the sun (`directionalLight`) arcs and the shadow sweeps the hours. Explicit depth `target()` as a shadow map, then a present `effect()`. The gallery has lighting and HDR bloom, but no shadow mapping; Hourglass fakes contact shadows in the opaque pass.

- [ ] **GPU metaballs** — Several implicit spheres in a compute marching-cubes / surface-nets pass, written to a storage mesh and drawn with a lit shader. Organic blobs that merge and split. Distinct from Clipping (a plane slice of one icosphere) and from raymarched SDFs (Wobbler, Black Hole, Raymarched Fractal).

## Notes

- Strongest unique API coverage: clay sculpt (edit + inspect), crowded colonnade (`visibility`), reaction-diffusion coral (`pingPong`), murmuration (`pingPongStorage` + indirect compute).
- Closest to this repo’s object-on-a-table taste: orrery, draped still-life, orthographic cabinet, sundial.
- Closest to Wobbler’s “one kinetic system” taste: murmuration, GPU metaballs.
