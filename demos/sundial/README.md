# Implementation Prompt: Garden Sundial, Synced to the Sky

Build a high-quality 3D scene of a real horizontal sundial in a quiet courtyard. The gnomon’s shadow must fall on the correct hour line for the **current instant** at a chosen place on Earth. The sun sits in the right place in the sky; the shadow is a true projected silhouette, not a painted decal. The viewer can orbit, zoom, and pan around the dial. The deliverable is a living instrument, not a looping animation.

**Default place: Auckland, Aotearoa New Zealand** (36.8509° S, 174.7645° E, `Pacific/Auckland`).

This is a design / implementation brief. Shader and TypeScript files come in a later pass. Do not add `index.html` until the first renderable frame exists — Vite treats every `demos/<id>/` folder as a build input.

---

## Intent

A weathered stone dial on a short pedestal, late-afternoon garden light, brass that has gone green at the edges. The triangular gnomon is a polar **style**: it points at the celestial pole, so its shadow is a clock hand. Walk around it. Read the hour from the plate. Change city, and the whole sky, the sun, the gnomon tilt, and the engraved hour lines rebuild for that latitude.

The point of the demo is that **civil time, solar geometry, and the rendered shadow agree**. If it is 3:17 pm in Auckland on a clear March afternoon, the style’s shadow lies on the plate where a correctly made Auckland sundial would put 3:17 apparent solar time — after the equation of time, longitude, and daylight saving have been applied. Night is night: the sun is below the horizon, the courtyard goes cool, and there is no fake noon shadow.

vgpu work this repo has not done yet: a real shadow map (`target` depth from the sun, sampled in the lit pass), a `directionalLight` whose direction is physical, and `orthographicCamera` as the light camera.

---

## 1. Location and civil time

The sundial always belongs to **one geographic place**: latitude φ, longitude λ, IANA timezone. Civil time at that place drives the sun. The viewer’s laptop clock is only a UTC source.

### Resolution order

1. **Immediate default** — Auckland, so the first frame never waits on permissions or a network.
2. **City field** — user types a name (typeahead against a curated gazetteer). Selecting a city sets φ, λ, and timezone. This overrides everything else.
3. **Use my location** — `navigator.geolocation.getCurrentPosition` (user gesture, not on page load). On success, use the returned latitude/longitude; keep civil time in `Intl.DateTimeFormat().resolvedOptions().timeZone` (the browser’s zone is the right zone for “where I am”). Label the HUD “My location” and snap the typeahead to the nearest gazetteer city if one is within ~80 km, otherwise show `φ, λ` in degrees.
4. **Timezone hint (optional, non-blocking)** — if the user has not chosen a city and has not granted geolocation, map `Intl`’s IANA zone onto the gazetteer (`Pacific/Auckland` → Auckland, `Europe/London` → London). Do **not** override an explicit city. Offer this as a quiet “Use browser timezone” suggestion rather than a jump on first paint.

Persist the last explicit city (or “my location” flag) in `localStorage`.

### Gazetteer

Ship a static table in-repo. No geocoding API. Roughly 40–60 well-known cities, each with `{ name, country, lat, lon, timeZone }`. Include at least:

Auckland (default), Wellington, Sydney, Melbourne, Tokyo, Singapore, Mumbai, Dubai, Cairo, Johannesburg, Nairobi, Athens, Rome, Paris, London, Berlin, Stockholm, Moscow, Reykjavík, New York, Chicago, Denver, Los Angeles, Mexico City, São Paulo, Buenos Aires, Santiago, Honolulu, Anchorage, Vancouver.

Typeahead is case-insensitive prefix / subsequence match. Unknown strings do not geocode; the field stays on the last valid place.

### Time

Every frame (or once per second — the sun does not need 60 Hz):

- `now = new Date()` as UTC.
- Expand `now` into year, month, day, hour, minute, second **in the place’s timezone** with `Intl.DateTimeFormat` + `formatToParts` (`hourCycle: "h23"`). This is how DST is applied; do not hard-code offsets.
- Feed those civil components plus φ, λ into the solar model.

HUD shows:

- Place name
- Civil clock `HH:MM` and timezone abbreviation
- Apparent solar time (so a curious viewer can see the equation-of-time gap)
- Solar altitude / azimuth
- A one-line status when the sun is down (“Night — sun 12° below the horizon”)

Optional scrub: a date/time slider that offsets from “now” (range: −12 h … +12 h, plus a day-of-year slider). Default is live. A “Now” button clears the offset.

---

## 2. Solar geometry (must be physically placed)

Use a compact SPA-lite, not a toy `sunY = sin(clock)`. NOAA / Spencer / Michalsky accuracy of ~0.3° is enough for a garden dial. All angles in radians internally; degrees only at the UI.

Given UTC instant, φ, λ:

1. Julian date → geometric mean longitude, mean anomaly.
2. **Solar declination** δ.
3. **Equation of time** E (minutes). Peak ~±16 min; without it the shadow disagrees with a wristwatch.
4. Longitude correction: `offsetHours = λ / 15` (λ east-positive).
5. Local apparent solar time:  
   `LAST = civilTimeHours + (λ − tzMeridian) / 15 + E / 60`  
   where `tzMeridian` is the timezone’s standard meridian implied by the current UTC offset (`offsetHours * 15` from `Intl`, which already includes DST). Simpler and equivalent: convert civil time to UTC, then  
   `LAST = UTChours + λ/15 + E/60` (wrap to 0–24).
6. **Hour angle** H = 15° × (LAST − 12). Negative morning, positive afternoon.
7. **Altitude** α:  
   `sin α = sin φ sin δ + cos φ cos δ cos H`
8. **Azimuth** A, measured from **true north, increasing east** (compass convention):

   ```
   sin A = −cos δ sin H / cos α
   cos A = (sin δ − sin α sin φ) / (cos α cos φ)
   A = atan2(sin A, cos A)
   ```

Clamp α to the real horizon for lighting (see night). Keep the true α for the HUD even when negative.

### World-space sun vector

Scene axes (right-handed, Y-up):

| Axis | Geographic |
| --- | --- |
| +X | East |
| +Y | Up |
| +Z | North |

Sun direction **from the origin toward the sun**:

```
sun = ( cos α · sin A,   sin α,   cos α · cos A )
```

The `directionalLight` travels **toward** the scene, so its `direction` is `−sun`. Place a visible sun disk on the sky along `sun` (section 6).

Auckland check (southern hemisphere): at local solar noon the sun is **due north**, altitude ≈ 90° − |φ| + δ. In December (summer) that is high in the northern sky; in June it is lower. The noon shadow of the style falls **due south** (−Z). If a June Auckland noon shadow falls north, the axes or the sign of φ are wrong.

---

## 3. Sundial geometry (critical)

This is a **horizontal sundial** with a polar gnomon. Do not use a vertical stick (that is a shepherd’s gnomon and the hour lines are different).

### Plate

- Circular stone disk, diameter 90–110 cm, thickness 6–8 cm, slight bevel on the rim.
- Sits on a square or octagonal pedestal ~85–95 cm tall, so the plate is near standing-waist height. Pedestal has a moulded cap and base.
- Plate lies in the XZ plane, centre at the origin, top face at y ≈ 0.

### Gnomon (style + optional nodus)

- A thin triangular bronze fin in the **meridian plane** (the YZ plane, x = 0).
- The **style** (the upper sloping edge that casts the hour-shadow) is parallel to Earth’s axis.
- Style elevation above the plate = `|φ|`.
- **Northern latitudes** (φ > 0): the style rises toward **north** (+Z). The high end points at the north celestial pole.
- **Southern latitudes** (φ < 0): the style rises toward **south** (−Z). Auckland’s gnomon points south.
- At the equator, degenerate to a vertical style in the meridian; hide the triangle and use a thin rod.
- Style length such that the summer-solstice noon shadow still lands on the plate (compute from max |δ| ≈ 23.44°).
- A small spherical **nodus** (bead) on the style, ~1/3 of the way up. Its shadow is a point that walks the date curves.

When the user changes hemisphere or |φ| by more than a fraction of a degree, **rebuild** the gnomon mesh and the hour-line engravings. Do not rotate a northern gnomon and call it Auckland.

### Hour lines

Engrave on the plate, radiating from the style’s root (the point where the style meets the plate).

Horizontal-dial formula, H = hour angle from noon:

```
tan(θ) = sin(φ) · tan(H)
```

θ is the angle of the hour line from the **noon line**, signed. `sin(φ)` being negative in the south automatically mirrors morning and afternoon.

Draw lines for each hour from 04:00 to 20:00 where they intersect the disk (winter mornings may run off the plate — clip to the rim). Noon is the meridian. Numerals sit just inside the rim, roman or humanist sans, **IIII** for four (traditional dial maker’s four). Face the numerals so they read from the south side of the plate in the north, and from the north side in the south — the side you stand on to see the sun behind the gnomon at noon.

Finer 30-minute ticks, unnumbered. A short **true-north** mark and a small cross at the origin.

### Date curves (quality extra, expected)

The nodus shadow on a horizontal dial traces a hyperbola (solstices) or a straight east–west line (equinoxes). Engrave:

- Summer solstice (δ = +23.44°)
- Equinoxes (δ = 0)
- Winter solstice (δ = −23.44°)

These make the plate look like a real instrument and give an immediate check: on an equinox the nodus shadow should ride the straight line.

### Furniture

Keep it spare so the shadow stays readable:

- Coarse gravel / packed earth court, ~6–8 m across.
- Low box hedge or a simple stone kerb as a circular boundary.
- Distant garden wall or a couple of cypress silhouettes for scale and for something to catch the shadow at low sun.
- No competing hero props. No glass.

---

## 4. Materials

Physically plausible, not a PBR showcase.

- **Plate**: pale limestone / Portland. Albedo ~0.55–0.65, roughness 0.55. Subtle procedural pits and lichen in the engraving grooves (darker, rougher). Grooves must be geometric (a millimetre of inset), not only a texture, so they catch a contact shadow.
- **Gnomon**: aged bronze. Albedo ~0.25, 0.16, 0.08. Verdigris in recesses (hue toward 0.35, 0.45, 0.28). Specular lobe tight enough to flash once as you orbit.
- **Pedestal**: slightly darker stone, faint tool marks.
- **Ground**: warm gravel. Fine noise, not a tiling photograph. Darkens under the pedestal (AO or a baked-looking contact term is fine here).
- **Hedges / trees**: lambert green, two values, no attempt at individual leaves.

Use `@vgpu/wgsl-std/noise/simplex` (`fbmSimplex2d` / `fbmSimplex3d`) for stone and gravel. Do not invent a second noise.

Lit shading is a custom WGSL draw (same pattern as Hourglass opaque), **plus** a shadow-map term. Scene-graph `lambertMaterial` is not required; `directionalLight` values can still be authored as scene helpers and packed into uniforms.

---

## 5. Shadow mapping (the demo’s technical centre)

Three GPU passes in one `frame` / `frameLoop`:

1. **Sun depth** — render the casters (gnomon, plate, pedestal, hedges) from the sun into an offscreen depth `target`. Light camera is `orthographicCamera`, fitted tightly around the court AABB, looking along `−sun` (from the sun toward the origin). Size 2048². Colour attachment can be a dummy `r16float` or unused if vgpu requires a colour target; depth is what we sample. Compare `less`. Slope-scale depth bias in the caster, or a small constant bias in the receiver, to kill shadow acne on the plate without swallowing the gnomon contact.
2. **Lit scene** — offscreen colour + depth `target` (the usual vgpu two-pass recipe: canvases have no depth). Perspective camera. Sample the sun-depth map with 3×3 PCF. Receiver: plate, ground, pedestal, hedges. The gnomon may be excluded as a receiver so it does not self-shadow into a muddy bronze. Attenuation: `shadow * N·L` with a small ambient (sky hemisphere).
3. **Present** — full-screen `effect` samples the lit colour target onto `surface(gpu, canvas)`. Tonemap with `tonemapAces` from `@vgpu/wgsl-std/color`. Optional short bloom only on the sun disk (keep it restrained; this is not the Earth / black-hole bloom chain).

Light-camera fit: recompute the orthographic box when the sun moves so the frustum stays tight. When α < ~8°, stretch the frustum along the light direction; shadows get long, texel density on the plate must stay high — bias the fit to cover the **plate first**, let distant hedges go coarse.

Softness: PCF radius small. A sundial’s style shadow should look like a **crisp blade** on the numerals, not a contact-shadow blob. Hourglass-style faked AO under a base is not enough here.

---

## 6. Sky and sun disk

The sky must contain the same sun the shadow uses. If the disk is in the west and the shadow says morning, the demo has failed.

- Full-screen or skydome background in the lit pass (draw first, depth off or far).
- Analytical gradient: Rayleigh-ish blue toward zenith, warmer toward the horizon, driven by α. Simple Preetham / Hosek coefficients are welcome; a hand-tuned gradient keyed by altitude is acceptable if the sun disk is correctly placed.
- **Sun disk**: small limb-darkened disc in direction `sun`, angular radius ~0.53°. Bright enough to clip into the ACES shoulder. At golden hour the disk goes amber; at noon it is white-yellow.
- Horizon band: faint distant hills or a linear fog so the court does not float in a void.
- No star field. If it is night, a deep indigo and a dim milky-way suggestion is enough.

Fill light: cool low-intensity ambient from the sky colour, plus a weak warm bounce from the gravel (`+Y` down-up). Key is only the directional sun.

---

## 7. Camera and interaction

- `perspectiveCamera`, 50–65 mm equivalent, `orbitControls` as in Dodecahedron / Hourglass.
- Default view: 3/4, slightly above plate height, looking down ~25–35°, standing on the **equator-facing** side of the dial (north of the plate in Auckland, south of the plate in London) so the gnomon silhouette and the numerals both read.
- Orbit, zoom, pan (reuse the existing right/middle-button pan helper if it has been factored; otherwise copy it).
- Do not auto-orbit. The shadow is the motion.
- On place change, keep camera distance; optionally ease the azimuth to the new default side.

---

## 8. Night, twilight, polar edge cases

- **α > 5°**: full sun, hard shadows.
- **0° < α ≤ 5°**: dim and warm the key, keep shadows, raise ambient.
- **α ≤ 0°**: skip the shadow pass (or bind a white dummy). No directional key. Sky and HUD say it is night. Do not leave a stale noon shadow.
- **Midnight sun / polar night**: if |φ| is high and α never crosses zero that day, follow the same rules from the actual α. Rebuild the gnomon; hour lines will crowd — that is correct and should look strange.
- **φ ≈ 0**: equatorial special case (section 3).

Never place the light camera on the underside of the ground.

---

## 9. UI

Match Hourglass chrome: back link, bottom-left HUD, bottom-right glass panel.

Panel:

- City text field + typeahead list.
- Button: **Use my location**.
- Button: **Auckland** (reset).
- Optional: date offset, hour offset, **Now**.
- Readouts: civil time, solar time, altitude, azimuth, φ / λ.

HUD title: **Sundial**. One sentence under it: place, then “the shadow is apparent solar time”.

Keyboard: optional `n` for Now. No other secret keys.

---

## 10. What “done” looks like (acceptance)

Treat the shot as finished only if all of these are true:

- Default load is Auckland. Gnomon slopes **south**, style angle ≈ 36.9°.
- At Auckland solar noon the style shadow lies on the noon line and points **south**. Morning shadow lies west of noon, afternoon east.
- Changing the city to London rebuilds a **north-pointing** gnomon at ≈ 51.5°, and solar noon sends the shadow **north**.
- The visible sun in the sky, the directional light, and the shadow are one vector. Orbit does not unstick them.
- Civil time uses the place’s timezone including DST (`Pacific/Auckland` in January vs June).
- Equation of time is applied: on ~3 November the solar-vs-civil gap is about a quarter hour; the HUD shows it and the shadow matches solar, not civil, time.
- The style shadow is a sharp dark wedge that you can read against the engraved hours from several camera angles.
- After sunset there is no sun disk above the horizon and no gnomon hour-shadow.
- Stone, bronze, and gravel read as real materials in orbit; no chrome-plastic gnomon, no tiling photo textures.
- Geolocation is opt-in. City typeahead works offline from the gazetteer. Unknown cities do not crash.

---

## 11. Suggested module breakdown

```
demos/sundial/
  README.md          ← this brief
  index.html
  style.css
  main.ts            ← init, resize, frame loop, HUD
  location.ts        ← gazetteer, typeahead, geolocation, timezone civil time
  sun.ts             ← SPA-lite: declination, EoT, altitude, azimuth, sun vector
  dial.ts            ← hour lines, date curves, gnomon triangle for a given φ
  meshes.ts          ← plate, pedestal, court, hedges (procedural)
  shadow.ts          ← light orthographic camera, depth target, PCF helpers
  opaque.wgsl        ← lit receivers + shadow sample
  depth.wgsl         ← shadow-caster vertex (position only)
  sky.wgsl           ← gradient + sun disk
  present.wgsl       ← blit + ACES
```

CPU solar math stays in TypeScript (`sun.ts`). Shaders consume a packed uniform: `sunDirection`, `sunColor`, `lightViewProjection`, `shadowBias`, `timeOfDay`.

---

## 12. Parameters to expose

`place` (city id or lat/lon), `timeOffsetHours`, `dayOfYearOffset`, `gnomonThickness`, `plateRadius`, `shadowMapSize` (1024 / 2048 / 4096), `shadowBias`, `pcfRadius`, `exposure`.

Debug toggles (off by default): draw the light-camera frustum, visualise the shadow map in a corner, draw the sun vector as a line, freeze time.

---

## 13. vgpu notes for the implementer

- Follow the two-pass colour recipe: `target(gpu, { size, depth: true })` then `effect` onto `surface(gpu, canvas)`. Add a **third** pass in front for sun depth.
- `orthographicCamera` for the light; `perspectiveCamera` + `orbitControls` for the view.
- `directionalLight({ direction: [-sun.x, -sun.y, -sun.z], intensity, color })` as the authoring object; copy into the opaque uniform each tick.
- Request no extra device features. Depth comparison sampling uses a comparison sampler on the shadow target’s depth texture — confirm vgpu bind rules for depth textures; if comparison samplers are awkward, sample depth as a `texture_depth_2d` with `textureSampleCompare` in WGSL.
- `clock(gpu)` may run the loop, but **astronomical time comes from `Date`**, not from `clock.time`. Using the render clock as the hour would desync the instrument.
- First pipeline compile lands in the first frame; keep draws stable (one plate draw, one gnomon draw, one ground draw) so later frames are cheap.

---

## 14. Out of scope

Analemmatic (human-shadow) dials, vertical wall dials, refraction near the horizon, lunar dials, a full SPA to arc-seconds, online geocoding, weather / cloud shadows, moving people. One horizontal polar-style sundial, done properly.
