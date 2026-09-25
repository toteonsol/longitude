/**
 * Mask geometry and path math. Pure functions, no React: the client component draws them, the
 * seed never needs them, and they can be rendered headless to check a face.
 */
import type { Expression } from "./data";

export const IVORY = "#f5f0e6";
export const CHARCOAL = "#1b1b22";
export const CRIMSON = "#b3122e";
export const HOLE = "#08080b";

/** The parts of a mask that never change: carved once from the address, worn on both faces. */
export interface MaskGeometry {
  cheek: number;
  chin: number;
  forehead: number;
  eyeW: number;
  eyeSlant: number;
  browWeight: number;
  mouthW: number;
  nose: 0 | 1 | 2;
  ornament: 0 | 1 | 2 | 3;
  cheekMark: 0 | 1 | 2;
  tearSide: -1 | 1;
  blinkJitter: number;
}

/** FNV-1a seed + xorshift stream: same wallet, same mask, every load. */
export function maskGeometry(seed: string): MaskGeometry {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const next = () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
  const pick = (n: number) => Math.floor(next() * n);
  return {
    cheek: 78 + next() * 12,
    chin: 216 + next() * 16,
    forehead: -6 + next() * 12,
    eyeW: 15 + next() * 7,
    eyeSlant: next() * 2 - 1,
    browWeight: 4.5 + next() * 3.5,
    mouthW: 28 + next() * 12,
    nose: pick(3) as 0 | 1 | 2,
    ornament: pick(4) as 0 | 1 | 2 | 3,
    cheekMark: pick(3) as 0 | 1 | 2,
    tearSide: next() < 0.5 ? -1 : 1,
    blinkJitter: next(),
  };
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** The face at any point between the two expressions. */
export function blend(spot: Expression, perp: Expression, t: number): Expression {
  return {
    mouth: lerp(spot.mouth, perp.mouth, t),
    brow: lerp(spot.brow, perp.brow, t),
    eyes: lerp(spot.eyes, perp.eyes, t),
    heat: lerp(spot.heat, perp.heat, t),
    tear: t < 0.5 ? spot.tear : perp.tear,
  };
}

const r = (n: number) => (Math.round(n * 10) / 10).toString();

export const EYE_Y = 98;
export const EYE_DX = 31;
export const MOUTH_Y = 172;

export function outlinePath(g: MaskGeometry): string {
  const c = g.cheek;
  const top = 10;
  const chin = g.chin;
  return [
    `M100 ${top}`,
    `C ${r(100 + c * 0.62)} ${top} ${r(100 + c)} ${r(44 + g.forehead)} ${r(100 + c)} 98`,
    `C ${r(100 + c)} 150 ${r(100 + c * 0.6)} ${r(chin - 24)} 100 ${r(chin)}`,
    `C ${r(100 - c * 0.6)} ${r(chin - 24)} ${r(100 - c)} 150 ${r(100 - c)} 98`,
    `C ${r(100 - c)} ${r(44 + g.forehead)} ${r(100 - c * 0.62)} ${top} 100 ${top} Z`,
  ].join(" ");
}

/** A lens between two lids. `open` narrows to a squint, `mouth` lifts or drops the outer corner. */
export function eyePath(g: MaskGeometry, open: number, mouth: number, side: -1 | 1): string {
  const cx = 100 + side * EYE_DX;
  const w = g.eyeW;
  const up = 3 + 13 * open;
  const lo = 2 + 8 * open;
  const lift = g.eyeSlant * 3 + mouth * 7;
  const ix = cx - side * w;
  const ox = cx + side * w;
  const oy = EYE_Y - lift;
  const dx = ox - ix;
  return [
    `M ${r(ix)} ${EYE_Y}`,
    `C ${r(ix + dx * 0.3)} ${r(EYE_Y - up)} ${r(ix + dx * 0.72)} ${r(EYE_Y - up - lift * 0.5)} ${r(ox)} ${r(oy)}`,
    `C ${r(ix + dx * 0.72)} ${r(EYE_Y + lo - lift * 0.3)} ${r(ix + dx * 0.3)} ${r(EYE_Y + lo)} ${r(ix)} ${EYE_Y} Z`,
  ].join(" ");
}

/** brow = -1 knits the inner end down toward the eye; +1 raises the whole arch. */
export function browPath(g: MaskGeometry, brow: number, side: -1 | 1): string {
  const cx = 100 + side * EYE_DX;
  const base = EYE_Y - 30;
  const ix = cx - side * 19;
  const ox = cx + side * 24;
  const iy = base + 2 - brow * 8;
  const oy = base - 4 + brow * 2;
  const mx = (ix + ox) / 2 + side * 2;
  const my = Math.min(iy, oy) - 6 - 7 * (0.5 + 0.5 * brow);
  return `M ${r(ix)} ${r(iy)} Q ${r(mx)} ${r(my)} ${r(ox)} ${r(oy)}`;
}

/** The opening: corners fixed, the centre drops for a grin and climbs for a frown. */
export function mouthPath(g: MaskGeometry, m: number, outset = 0): string {
  const mw = g.mouthW + outset;
  const k = m * 22;
  const th = 8 + 8 * Math.abs(m) + outset * 1.6;
  const lx = 100 - mw;
  const rx = 100 + mw;
  return `M ${r(lx)} ${MOUTH_Y} Q 100 ${r(MOUTH_Y + k - th)} ${r(rx)} ${MOUTH_Y} Q 100 ${r(MOUTH_Y + k + th)} ${r(lx)} ${MOUTH_Y} Z`;
}

export function tearPath(g: MaskGeometry): string {
  const x = 100 + g.tearSide * (EYE_DX + 5);
  const y = EYE_Y + 22;
  return `M ${x} ${y} C ${x - 5} ${y + 9} ${x - 6.5} ${y + 15} ${x} ${y + 18} C ${x + 6.5} ${y + 15} ${x + 5} ${y + 9} ${x} ${y} Z`;
}

export function ribbonPath(g: MaskGeometry): string {
  const c = g.cheek;
  return `M ${r(100 + c - 5)} 84 l 19 -11 l -4 20 Z M ${r(100 - c + 5)} 84 l -19 -11 l 4 20 Z`;
}

export const NOSES: Record<MaskGeometry["nose"], string> = {
  0: "M 100 118 C 96 128 95 138 99 144 C 102 146 106 145 108 141",
  1: "M 92 141 q 4 5 8 0 M 100 141 q 4 5 8 0",
  2: "M 100 116 V 136 M 93 143 q 7 6 14 0",
};
