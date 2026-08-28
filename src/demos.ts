export type Demo = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
};

const base = import.meta.env.BASE_URL;

/** Add an entry here whenever you create demos/<id>/index.html */
export const demos: readonly Demo[] = [
  {
    id: "dodecahedron",
    title: "Dodecahedron",
    description: "Red, white, and blue faces with orbit, zoom, and pan.",
    href: `${base}demos/dodecahedron/`,
  },
  {
    id: "the-wobbler",
    title: "The Wobbler",
    description: "Alien ringworld propulsion at ~1 AU from a Sol-type sun.",
    href: `${base}demos/the-wobbler/`,
  },
];
