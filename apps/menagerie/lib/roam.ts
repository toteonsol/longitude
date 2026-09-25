import type { Animal, SpeciesId } from "./data";

/** Where on the plate a species lives. Hummingbirds take the sky, whales the water hole, the rest the grass. */
export type Zone = "sky" | "water" | "ground";

export interface RoamPlan {
  zone: Zone;
  /** Four waypoints in percent of the stage; the first half of the loop heads right, the second half comes back. */
  x: [number, number, number, number];
  y: [number, number, number, number];
  /** Seconds for one full loop. */
  dur: number;
  /** Negative start offset so the herd is already mid-stride on load. */
  delay: number;
  /** Depth order; larger is nearer. */
  z: number;
  /** Size multiplier from depth. */
  scale: number;
}

const ZONE: Record<SpeciesId, Zone> = {
  whale: "water",
  hummingbird: "sky",
  fox: "ground",
  tortoise: "ground",
  hyena: "ground",
  elephant: "ground",
  meerkat: "ground",
};

/** Base loop length in seconds; the tortoise is the joke. */
const PACE: Record<SpeciesId, number> = {
  hummingbird: 16,
  meerkat: 26,
  fox: 30,
  hyena: 36,
  elephant: 54,
  whale: 64,
  tortoise: 96,
};

/** Bands in percent of stage height. Ground bands go far to near. */
const SKY = { x: [6, 92], y: [9, 30] } as const;
const WATER = { x: [10, 40], y: [42, 47] } as const;
const GROUND_X = [4, 94] as const;
const GROUND_BANDS: ReadonlyArray<readonly [number, number]> = [
  [53, 60],
  [62, 70],
  [72, 80],
  [80, 88],
];

export function zoneFor(id: SpeciesId): Zone {
  return ZONE[id];
}

/** Small deterministic hash so a wallet always takes the same path. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function plan(
  address: string,
  species: SpeciesId,
  xr: readonly [number, number],
  yr: readonly [number, number],
  scale: number,
  /** 0..1 start offset along the range, so a crowded zone begins spread out rather than piled up. */
  spread?: number,
): RoamPlan {
  const r = mulberry32(seedFrom(address));
  const span = xr[1] - xr[0];
  const start = spread === undefined ? r() * 0.35 : spread * 0.5 + r() * 0.08;
  const x0 = xr[0] + start * span;
  const x2 = Math.min(xr[1], x0 + (0.35 + r() * 0.35) * span);
  const x1 = x0 + (x2 - x0) * (0.35 + r() * 0.3);
  const x3 = x0 + (x2 - x0) * (0.3 + r() * 0.35);
  const jitter = (yr[1] - yr[0]) * 0.6;
  const y0 = yr[0] + r() * (yr[1] - yr[0]);
  const wander = () => clamp(y0 + (r() - 0.5) * 2 * jitter, yr[0], yr[1]);
  const dur = PACE[species] * (0.85 + r() * 0.3);
  const zone = ZONE[species];
  return {
    zone,
    x: [round1(x0), round1(x1), round1(x2), round1(x3)],
    y: [round1(y0), round1(wander()), round1(wander()), round1(wander())],
    dur: Math.round(dur),
    delay: -Math.round(r() * dur),
    z: zone === "sky" ? 5 : Math.round(y0),
    scale,
  };
}

/** One plan per animal, spreading the ground dwellers across depth bands so they do not all crowd one line. */
export function planHerd(animals: Animal[]): RoamPlan[] {
  let ground = 0;
  return animals.map((a) => {
    const zone = ZONE[a.species];
    if (zone === "sky") return plan(a.address, a.species, SKY.x, SKY.y, 0.9);
    if (zone === "water") return plan(a.address, a.species, WATER.x, WATER.y, 0.8);
    const band = GROUND_BANDS[ground % GROUND_BANDS.length] ?? GROUND_BANDS[0]!;
    const depth = (ground % GROUND_BANDS.length) / (GROUND_BANDS.length - 1);
    const spread = (ground * 0.618) % 1;
    ground += 1;
    return plan(a.address, a.species, GROUND_X, band, 0.72 + depth * 0.48, spread);
  });
}
