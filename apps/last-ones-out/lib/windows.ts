import type { Building } from "./data";

/* Geometry in px. Keep in sync with the --win-* tokens in app/globals.css. */
export const WIN = { w: 9, h: 11, gapX: 5, gapY: 5, padX: 8, padTop: 14, padBottom: 10 } as const;
export const HEIGHT = { min: 118, max: 372 } as const;

export const buildingKey = (b: Pick<Building, "chain" | "address">): string => `${b.chain}:${b.address}`;

/** FNV-1a, so a building draws the same on the server and in the browser. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32: small, fast, deterministic. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export type Roof = "flat" | "step" | "spire" | "antenna";
/** a = amber, b = warm white, c = ember. */
export type Tint = "a" | "b" | "c";

export interface WindowPlan {
  /** Lit at dusk. */
  lit: boolean;
  /** Switches off during the blackout. */
  off: boolean;
  /** Flickers a couple of times before going dark. */
  flicker: boolean;
  /** A survivor whose glow slowly breathes. */
  breathe: boolean;
  /** Seconds: when it goes dark, or the breathing offset. */
  delay: number;
  tint: Tint;
}

export interface BuildingPlan {
  cols: number;
  floors: number;
  count: number;
  litCount: number;
  offCount: number;
  stillOn: number;
  width: number;
  height: number;
  roof: Roof;
  tone: string;
  riseDelay: number;
  blackout: { start: number; duration: number };
  windows: WindowPlan[];
}

/**
 * Turns a building's scores into a window grid and a blackout schedule. Deterministic per building:
 * height ∝ `height`, windows lit ∝ `lit`, windows that go dark ∝ `darkness`, top floors first.
 */
export function planBuilding(b: Building, index: number): BuildingPlan {
  const rand = rng(hashSeed(buildingKey(b)));

  const rawHeight = HEIGHT.min + b.height * (HEIGHT.max - HEIGHT.min);
  const floors = Math.max(3, Math.floor((rawHeight - WIN.padTop - WIN.padBottom + WIN.gapY) / (WIN.h + WIN.gapY)));
  const height = WIN.padTop + WIN.padBottom + floors * WIN.h + (floors - 1) * WIN.gapY;
  const baseCols = b.height > 0.72 ? 5 : b.height > 0.4 ? 4 : 3;
  const bump = rand();
  const cols = Math.max(3, Math.min(6, baseCols + (bump < 0.22 ? 1 : bump > 0.86 ? -1 : 0)));
  const width = 2 * WIN.padX + cols * WIN.w + (cols - 1) * WIN.gapX;
  const count = cols * floors;

  const litCount = Math.round(count * b.lit);
  const offCount = Math.round(litCount * b.darkness);
  const litIdx = shuffle(
    Array.from({ length: count }, (_, i) => i),
    rand,
  ).slice(0, litCount);
  // Lights go out from the top floors down, with enough noise that no two buildings empty the same way.
  const keyed = litIdx.map((i) => ({ i, k: Math.floor(i / cols) + rand() * floors * 0.5 })).sort((p, q) => p.k - q.k);
  const riseDelay = round2(index * 0.07);
  const blackout = { start: round2(1.1 + riseDelay), duration: round2(0.6 + b.darkness * 3.4) };

  const windows: WindowPlan[] = Array.from({ length: count }, () => ({ lit: false, off: false, flicker: false, breathe: false, delay: 0, tint: "a" }));
  for (const i of litIdx) {
    const w = windows[i] as WindowPlan;
    w.lit = true;
    const t = rand();
    w.tint = t < 0.62 ? "a" : t < 0.9 ? "b" : "c";
  }
  keyed.slice(0, offCount).forEach(({ i }, k) => {
    const w = windows[i] as WindowPlan;
    w.off = true;
    w.flicker = rand() < 0.22;
    w.delay = round2(blackout.start + (k / Math.max(1, offCount)) * blackout.duration + rand() * 0.18);
  });
  for (const i of litIdx) {
    const w = windows[i] as WindowPlan;
    if (!w.off && rand() < 0.12) {
      w.breathe = true;
      w.delay = round2(rand() * 6);
    }
  }

  const roll = rand();
  const roof: Roof = b.rank === 1 ? "antenna" : roll < 0.45 ? "flat" : roll < 0.7 ? "step" : roll < 0.86 ? "spire" : "antenna";
  const tone = `hsl(231 44% ${(9 + rand() * 6).toFixed(1)}%)`;

  return { cols, floors, count, litCount, offCount, stillOn: litCount - offCount, width, height, roof, tone, riseDelay, blackout, windows };
}
