# vgpu-test

Experiments with **[vgpu](https://vgpu.sh)** — a small WebGPU library for effects, draws, and scene helpers.

This repo is a Vite multi-page playground: each demo lives under `demos/<id>/` and is listed from the home page. The goal is to try the API hands-on (shaders, orbit camera, full-screen raymarch effects) rather than to ship a polished product.

**Live site:** [avowkind.github.io/vgpu-test](https://avowkind.github.io/vgpu-test/)  
(Requires a WebGPU browser — Chrome / Edge, or a recent Safari.)

## Demos

| Demo | Notes |
| --- | --- |
| [Dodecahedron](https://avowkind.github.io/vgpu-test/demos/dodecahedron/) | Colored mesh, depth pass, orbit / zoom / pan |
| [The Wobbler](https://avowkind.github.io/vgpu-test/demos/the-wobbler/) | Raymarched ringworld + free mass at ~1 AU |

## The Wobbler

Creative brief (source: [`demos/the-wobbler/README.md`](demos/the-wobbler/README.md)):

> **A silent kinetic object in free fall: a single ring and a free ball locked in invisible harmonic exchange.**

In a zero-gravity void—black, airless, and unbounded—a circular ring hangs motionless. It is not a simple hoop. It is a thick, precision-machined torus of dark, satin-finished metal, perhaps 40–50 cm in outer diameter, with a generous open aperture. The surface is neither mirror-bright nor matte; it has the quiet sheen of aerospace alloy or superconducting alloy, interrupted by faint circumferential seams or hairline channels that suggest internal windings. A very low, cool luminescence lives just under the metal—an electric-blue or pale-cyan glow that pulses so faintly it is almost a memory of light rather than light itself. The glow is strongest on the inner equator of the ring, as if current is circulating. No wires trail away. No supports exist. The ring simply occupies space.

Through that aperture a sphere travels.

The ball is smaller than the inner diameter—roughly a third to two-fifths the clear opening—so it can pass cleanly without touching. It is a dense, seamless orb of polished metal or ceramic-metal composite, chrome-dark or mercury-bright depending on the lighting. Its surface is optically perfect; every reflection of the ring, the faint glow, and the surrounding darkness slides across it as it moves. There are no magnets visible on it, no collars, no tethers, no springs. It is a free body.

The motion is the entire point.

The ball does not drift. It does not bounce. It executes a long, slow, perfectly repeating oscillation along an axis that passes through the geometric centre of the ring. At the extreme of each stroke it hangs almost still, several ball-diameters away from the ring, as if it has reached the end of an invisible elastic tether. Then it begins to fall inward—not falling under gravity, but accelerating under a restoring force that grows stronger as it approaches the plane of the ring. Speed builds smoothly. By the time the ball reaches the aperture it is moving at its maximum velocity, shooting through the centre in a clean, decisive transit. The moment of passage is brief and silent: the sphere threads the ring, the inner glow briefly wrapping around its equator like a fleeting halo, reflections compressing and then releasing.

Once through, the same force that pulled it in now retards it. The ball climbs the other side, slowing with the same smooth curve, until it again comes to rest at the opposite extreme. A heartbeat of stillness, then the reversal. The cycle repeats. The velocity profile is that of a mass on a spring: maximum speed at the equilibrium (the ring plane), zero speed at the turning points. The path is predominantly linear, yet never perfectly sterile. A minute off-axis component—perhaps a few millimetres of conical wander or a slow precession—gives the transit a living quality. The ball does not pierce the ring like a bullet; it *wobbles* through, the sphere’s centreline tracing a very shallow figure-eight or a tight helix that never quite repeats the same way twice. That tiny instability is what makes the object feel alive rather than mechanical.

The force itself remains unseen, yet it is not magical. In this environment the only plausible agents are electromagnetic. One coherent reading is that the ring carries a steady or slowly modulated current, producing a magnetic field whose intensity is greatest in and near the plane of the loop. The ball, whether ferromagnetic or containing a trapped magnetic moment, is drawn toward the region of stronger field. From either side the potential is a well centred on the ring; the ball therefore accelerates inward, overshoots, and is drawn back. Another reading is inductive: time-varying currents in the ring induce eddy currents or opposing fields in a conducting ball, sculpting a restoring force without contact. A third, colder possibility is a superconducting ring whose persistent current and Meissner-like interaction with a magnetised core inside the ball creates a frictionless magnetic spring. In every case the attachments are fields, not matter. No filaments, no rods, no visible flux lines unless the artist chooses to render them as the faintest aurora—gossamer threads of ionised dust or polarised light that stretch and compress with the ball’s position, brightest when the sphere is farthest and the “spring” is most extended.

Lighting is sculptural and sparse. A single distant key light, cool and slightly blue, rakes across the ring so that the inner rim catches a thin specular highlight. The ball, being highly reflective, becomes a moving lens: at the far extremes it shows a small, distorted image of the ring floating in darkness; as it approaches, that image swells, warps, and then the ring itself fills the sphere’s surface before the ball punches through. Secondary fill is almost nonexistent, so the object lives in a pool of self-contained illumination. Occasional micro-particles—dust, ice crystals, or ferrofluid mist that has no business being there—drift in the field and briefly align, giving the invisible force a momentary, glittering texture before they scatter again.

The whole assembly is scale-less in the void, yet it feels intimate, the size of a large kinetic sculpture rather than an industrial machine. There is no sound in vacuum, but the visual rhythm supplies its own meter: long decelerations, a sudden bright transit, long decelerations again. The ring never moves. The ball never touches it. The only evidence that anything is “connected” is the implacable, spring-like obedience of the motion itself.

That is the wobbler: an object that looks like two separate things and behaves like one closed physical system, the force made visible only by what it does to the ball.

The implemented demo expands that idea into an alien ringworld ribbon at ~1 AU, with a optional plasma-sun mass, Sol key light, and camera sync modes (mass / ring / inner surface / free).

## Local development

```sh
npm install
npm run dev
```

Then open `/` for the demo index, or `/demos/the-wobbler/` and `/demos/dodecahedron/` directly.

```sh
npm run build    # production build (GitHub Actions uses this for Pages)
npm run preview  # serve dist/ locally
```

## Stack

- [vgpu](https://vgpu.sh) `^0.3.1`
- Vite + TypeScript
- WGSL via `@vgpu/wgsl/loader-vite`
