# Implementation Prompt: Hourglass on a Chessboard

Build a high-quality 3D scene of a standing hourglass on a wooden chessboard. Sand must visibly flow from the upper bulb through the neck into the lower bulb. Individual grains and the evolving pile geometry must be animated. The glass must have **uneven thickness** so the chessboard, room, and falling sand appear optically distorted (refraction + chromatic split + thickness-dependent absorption). The deliverable is a looping or one-shot animation, not a still.

## 1. Scene layout

- **Chessboard**: 8×8, square size ~5.5–6 cm. Light squares warm maple (~#d8c4a0), dark squares walnut (~#5c3a22). Visible wood grain, slight wear at edges, thin dark inlay lines between squares, 1–1.5 cm raised wooden frame with a small bevel. Board sits on a dark oak table that extends beyond the frame.
- **Hourglass placement**: centered on the board (intersection of d4/e4/d5/e5), standing upright. Bottom cap rests on the squares; a faint contact shadow and a tiny gap of 0.5–1 mm so it does not z-fight.
- **Hourglass overall height**: 18–22 cm. Two symmetric bulbs, narrow neck ~8–10 mm inner diameter. Wooden or aged-brass pillars at the four corners, circular top and bottom caps with a turned profile. Optional small brass plaques.
- **Environment**: a shallow room behind the board — bookshelves, a window with soft daylight, a few out-of-focus objects. This background exists so refraction through the glass has something rich to warp. HDRI + a rectangular window light is enough.
- **Camera**: 50–85 mm equivalent, 3/4 view, slightly above board height, looking down at ~25–35°. Slow optional orbit (±15°) over 12–20 seconds. Depth of field: board and hourglass sharp, far room slightly soft.

## 2. Hourglass geometry (critical)

Do **not** use a single thin shell.

- Construct the glass as a **surface of revolution** from a 2D profile (Catmull-Rom or cubic spline, ~12 control points).
- Generate **two meshes**:
  - Outer visual surface.
  - Inner collision / optical surface, offset inward by a **spatially varying thickness**.
- Thickness field (important):
  - Neck: 1.5–2.5 mm.
  - Mid-bulb walls: 3–4 mm.
  - Where the bulb meets the wooden caps: 5–7 mm.
  - Add low-frequency waviness (±0.4 mm) and 3–6 trapped air bubbles (ellipsoids 0.4–1.2 mm) embedded in the volume.
  - Slight asymmetry: one side of the upper bulb 8–12% thicker than the opposite side so distortion is not radially symmetric.
- Inner surface is the collision boundary for sand. Outer surface is what the camera sees.
- Caps and pillars are opaque wood/brass; they occlude sand at the very top and bottom.

## 3. Glass material (uneven thickness + distorted background)

Physically based dielectric.

- IOR 1.50–1.52 (soda-lime). Optional slight dispersion: IOR_R 1.515, IOR_G 1.520, IOR_B 1.528 so RGB refract separately.
- Roughness 0.02–0.06 on most of the surface; raise to 0.12 in a few fingerprint / wipe patches.
- **Volume / thickness effects** (pick the best path your renderer supports):
  - Preferred: true two-interface refraction (ray enters outer, travels through volume, exits inner). Use Beer–Lambert absorption: faint warm-green or tea-tint, absorption distance ~4–8 cm so thick regions look slightly greener/amber and thin neck stays almost clear.
  - Real-time fallback: screen-space refraction. Sample the opaque buffer with a refract(view, N, 1/IOR) offset **scaled by local thickness**. Split the offset for R/G/B (chromatic aberration). Add a faint thickness-tinted multiply. Do not use a uniform fake “glass sphere” distortion.
- Fresnel reflections on both interfaces. Sharp environment highlights on the outer surface.
- Tiny scratches (anisotropic, very subtle) and dust motes on the outer surface only.
- Sand inside the glass must be refracted as well: grains near the wall should appear displaced and slightly magnified.
- Optional quality extra: faint caustics projected onto the chessboard under the bulbs (can be a cookie / projective texture if full photon mapping is too heavy).

The viewer must clearly see the checker pattern **bend, magnify, and split** through the bulbs, and see a different warp through the neck versus the thick base.

## 4. Sand: look and motion

### Look
- Grain size 0.4–0.7 mm visual radius (can be slightly larger for readability).
- Color: warm desert gold. Per-grain hue jitter ±8°, value jitter ±10%. A few darker iron-oxide specks.
- Material: dielectric, roughness 0.45–0.7, slight subsurface or wrapped lighting so clumps do not look like plastic beads.
- Render as instanced spheres or small anisotropic grains. At rest in a pile they should read as a continuous sandy surface with grain sparkle, not a perfect lattice.

### Physics / animation (must be visible)
Implement a granular model that produces these observable behaviors:

1. **Upper chamber drain**  
   Sand sits in a mound. A crater / funnel forms above the neck. Grains peel off the inner slope and fall toward the orifice. The upper free surface slowly lowers and steepens, then avalanches when it exceeds the angle of repose.

2. **Neck flow**  
   Roughly constant volumetric rate (classic hourglass property). Only 1–3 grains fit through the neck at a time. Occasional brief jams then release are acceptable and look real. Grains accelerate in free fall below the neck.

3. **Impact and pile growth (the required “slopes adjust”)**  
   - Falling grains hit the lower pile, bounce 1–3 mm, then settle.  
   - The lower pile is a cone whose sides sit at an **angle of repose θ_r ≈ 32° ± 3°**.  
   - When a grain lands on a slope steeper than θ_r, a small surface avalanche runs downhill until the local slope ≤ θ_r.  
   - The apex of the cone slowly rises. The contact line with the glass wall creeps upward.  
   - You must see the slope **breathe**: a burst of arriving grains oversteepens a face, then the face slumps and the silhouette changes.

Suggested implementation (agent may pick one, but must hit the visual beats above):

- **Practical hybrid (recommended for real-time)**  
  - 2k–15k explicit particles for the moving / surface layer (DEM or simplified impulse + friction).  
  - Static bulk of the lower pile represented as a height field or coarse occupancy grid.  
  - Transfer rule (BCRE-style): if local slope > θ_r, erode height-field cells into particles; if particles come to rest below θ_r, deposit them into the height field.  
  - Separate collision mesh = inner glass. High friction and damping in the lower bulb so the pile actually rests. Lower damping in the upper bulb so it drains.

- **Higher fidelity**  
  MPM with Drucker–Prager plasticity, or full DEM with rolling friction. Use this if the target is offline / path-traced.

Sleep / freeze particles that have been below a velocity threshold for N frames so the pile does not slowly melt.

Gravity −9.81 m/s². Time step small enough that grains do not tunnel the neck (substep if needed).

### Timing
- Demo length 12–25 seconds of visible flow is enough.  
- Start with ~70% of the sand in the top bulb.  
- Loop by either reversing gravity / flipping the glass, or cross-fading back to the start pose.

## 5. Lighting

- Key: large soft area light from upper left (window), 5500–6500 K.  
- Fill: dim warm bounce from below / table.  
- Rim: cool sliver from the right so the glass edge reads.  
- Chessboard needs readable light/dark squares through the glass, so avoid crushing contrast.  
- Contact shadow under the hourglass base. Soft shadow of the pillars on the board.

## 6. What “done” looks like (acceptance)

An agent should treat the shot as finished only if all of these are true:

- Sand is clearly moving grain-by-grain through the neck, not a shader scroll or a static mesh.  
- The lower pile’s silhouette changes over time; slopes steepen then slump.  
- Upper surface develops a funnel, not a flat descending piston.  
- Looking through a bulb, the chessboard squares are warped, magnified near the center, compressed near the silhouette, and show a little RGB fringe. Warp strength changes with local glass thickness.  
- Glass is not a perfect thin shell: thick regions absorb/tint more and bend more.  
- Wood grain, brass wear, and glass dirt are present but secondary.  
- No obvious particle lattice, no sand leaking through glass, no flickering refraction.

## 7. Suggested module breakdown for the agent

1. Procedural hourglass profile → lathe inner/outer meshes + thickness attribute.  
2. Chessboard + table + simple room / HDRI.  
3. Glass BSDF or custom refraction shader driven by thickness.  
4. Sand solver (particles + repose-constrained pile).  
5. Collision: inner glass SDF or triangle mesh.  
6. Instanced grain renderer + optional height-field mesh for the settled bulk.  
7. Camera, lights, loop.

## 8. Parameters to expose

`repose_angle`, `neck_radius`, `grain_radius`, `flow_rate_scale`, `glass_ior`, `thickness_scale`, `dispersion`, `absorption_distance`, `camera_orbit`, `sand_count`.

