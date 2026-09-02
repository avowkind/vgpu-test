**A dusk flock that is one body until you break it.**

Last light over a marsh. Starlings pack into a single dark ribbon — thousands of small chevrons, not cubes, not sand — turning as if the air itself had a current. Iridescent green and violet flash only at the rim. The ground is wet meadow; the sky is a low sun on a violet zenith.

The flock is a GPU boid sim. Each bird reads its neighbors, steers (separation, alignment, cohesion), and writes the next state into the other half of a `pingPongStorage` pair. Clicking the canvas is a predator: a scare point unprojected onto the flock plane. Birds that bolt past the bounding ellipsoid die. A compact pass packs survivors; `dispatch({ indirect })` and an indirect instanced draw shrink with the live count. No CPU round-trip for how many remain.

Move the pointer to stir. Click (or space) to scatter. Reset refills the ribbon. Drag to orbit.
