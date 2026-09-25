import type { SpeciesId } from "./data";

/**
 * Hand-drawn silhouettes, one per species, in a 120×80 box, facing right, feet on y≈76.
 * `body` paths are filled with ink; `marks` are small details drawn in paper or species colour so
 * they read inside the solid shape; `wing` is the hummingbird's animated part.
 */
export interface SilhouetteSpec {
  body: string[];
  marks?: { d: string; tone: "paper" | "species" | "ink"; stroke?: boolean }[];
  eye?: [number, number, number];
  wing?: string;
}

export const SILHOUETTES: Record<SpeciesId, SilhouetteSpec> = {
  whale: {
    body: [
      // body, head to the right, tail stock to the left
      "M15 47 C24 33 50 22 80 24 C98 25 110 32 112 42 C114 50 106 58 92 60 C70 64 44 61 26 55 C20 53 16 51 15 50 Z",
      // fluke
      "M17 48 C12 44 8 38 6 33 C3 31 1 35 2 39 C4 43 7 47 9 49 C7 51 4 55 2 60 C1 64 3 67 6 65 C8 61 12 56 17 51 Z",
      // pectoral fin
      "M62 58 C58 64 51 68 42 71 L53 71 C61 69 66 65 70 60 Z",
    ],
    marks: [
      { d: "M111 44 C104 49 95 52 85 53", tone: "paper", stroke: true },
      { d: "M86 15 m-2.4 0 a2.4 2.4 0 1 0 4.8 0 a2.4 2.4 0 1 0 -4.8 0", tone: "species" },
      { d: "M80 8 m-1.7 0 a1.7 1.7 0 1 0 3.4 0 a1.7 1.7 0 1 0 -3.4 0", tone: "species" },
      { d: "M93 7 m-1.7 0 a1.7 1.7 0 1 0 3.4 0 a1.7 1.7 0 1 0 -3.4 0", tone: "species" },
      { d: "M87 2 m-1.1 0 a1.1 1.1 0 1 0 2.2 0 a1.1 1.1 0 1 0 -2.2 0", tone: "species" },
    ],
    eye: [102, 38, 1.7],
  },
  fox: {
    body: [
      "M34 58 C33 47 46 41 62 41 L86 44 C90 41 94 39 97 40 L98 31 L104 41 L108 30 L110 42 C114 46 117 50 118 54 L112 56 L106 55 C104 60 99 63 92 62 L92 76 L86 76 L86 63 L80 62 L80 76 L74 76 L74 62 L56 63 L56 76 L50 76 L50 63 L44 62 L44 76 L38 76 L38 61 C36 60 34 59 34 58 Z",
      // brush
      "M37 56 C26 53 13 58 5 70 C15 75 28 71 39 62 Z",
    ],
    marks: [{ d: "M5 70 C8 71.5 12 71.5 15 70 C12 67 9 66 6.5 67 Z", tone: "paper" }],
    eye: [105, 46, 1.6],
  },
  hummingbird: {
    body: [
      "M46 44 C48 36 57 32 66 34 C74 36 80 40 84 44 L112 40.5 L112 42.5 L86 49 C82 54 74 57 65 57 C55 57 48 52 46 46 Z",
      // forked tail
      "M48 50 L32 64 L36 63 L51 54 Z",
      "M47 47 L30 56 L34 58 L49 51 Z",
    ],
    wing: "M58 40 C52 28 56 12 72 8 C68 18 66 30 74 38 Z",
    eye: [78, 40, 1.3],
  },
  tortoise: {
    body: [
      "M20 62 C20 40 42 28 62 28 C82 28 102 40 102 62 L106 62 C108 56 116 54 119 58 C120 64 112 68 106 66 L98 66 L96 76 L88 76 L86 66 L76 66 L74 76 L66 76 L64 66 L52 66 L50 76 L42 76 L40 66 L30 66 L28 76 L20 76 L18 66 L12 72 L10 68 L16 62 Z",
    ],
    marks: [
      { d: "M40 41 C50 34 74 34 84 41", tone: "paper", stroke: true },
      { d: "M30 53 C50 45 72 45 92 53", tone: "paper", stroke: true },
      { d: "M52 30 L50 62", tone: "paper", stroke: true },
      { d: "M72 30 L74 62", tone: "paper", stroke: true },
    ],
    eye: [113, 59, 1.4],
  },
  hyena: {
    body: [
      "M28 60 C26 52 32 47 44 45 C58 42 70 38 80 33 L86 27 C88 22 93 22 94 28 L100 27 C102 22 107 22 108 28 L116 42 L114 47 L102 49 L94 52 C92 58 88 61 84 61 L86 76 L80 76 L78 62 L72 62 L72 76 L66 76 L64 62 L50 62 L50 76 L44 76 L42 62 L36 62 L34 76 L28 76 L30 64 C28 63 28 61 28 60 Z",
      // mane
      "M46 44 L48 37 L53 43 Z",
      "M56 41 L58 34 L63 40 Z",
      "M66 38 L68 31 L73 37 Z",
      "M76 34 L78 27 L83 33 Z",
      // tail
      "M30 58 C22 60 16 66 14 74 L19 74 C21 68 26 64 32 62 Z",
    ],
    marks: [
      { d: "M52 52 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0", tone: "paper" },
      { d: "M61 50 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0", tone: "paper" },
      { d: "M44 55 m-1.2 0 a1.2 1.2 0 1 0 2.4 0 a1.2 1.2 0 1 0 -2.4 0", tone: "paper" },
      { d: "M68 47 m-1.3 0 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0", tone: "paper" },
      { d: "M74 54 m-1.2 0 a1.2 1.2 0 1 0 2.4 0 a1.2 1.2 0 1 0 -2.4 0", tone: "paper" },
    ],
    eye: [104, 36, 1.5],
  },
  elephant: {
    body: [
      "M22 56 C22 40 36 30 56 28 C72 26 88 26 100 32 C108 36 112 44 110 54 L110 62 L104 62 L104 76 L96 76 L96 62 L88 62 L88 76 L80 76 L80 62 L54 62 L54 76 L46 76 L46 62 L38 62 L38 76 L30 76 L30 60 C26 60 22 58 22 56 Z",
      // ear: a flap standing proud of the head line
      "M94 36 C94 24 82 17 70 21 C62 24 60 34 63 42 C67 50 76 53 83 51 C90 49 94 43 94 36 Z",
      // trunk
      "M104 46 C112 48 118 56 117 66 C116 72 113 76 109 79 L113 80 C119 76 122 68 121 60 C120 50 114 42 106 40 Z",
      // tail
      "M23 46 C17 50 14 58 16 68 L20 68 C18 60 21 52 27 48 Z",
    ],
    marks: [{ d: "M104 55 C109 56 113 59 115 63 C112 62 108 60 104 59 Z", tone: "paper" }],
    eye: [97, 38, 1.6],
  },
  meerkat: {
    body: [
      "M64 14 C64 8 72 6 78 9 C82 11 84 16 82 20 L92 24 L82 26 C82 30 78 32 74 32 L76 38 C82 44 84 56 82 66 L82 76 L76 76 L76 66 L68 66 L68 76 L62 76 L62 66 C58 56 60 44 66 38 L66 32 C62 32 60 28 60 22 C60 18 62 16 64 14 Z",
      // tail as a prop
      "M64 62 C54 64 46 70 44 78 L49 78 C51 72 58 68 66 67 Z",
    ],
    marks: [
      { d: "M62 16 C58 14 56.5 19 61 21", tone: "paper", stroke: true },
      { d: "M73 41 C78 42 80 46 77 49 C74 48 72 46 71 44 Z", tone: "paper", stroke: true },
    ],
    eye: [78, 17, 1.4],
  },
};
