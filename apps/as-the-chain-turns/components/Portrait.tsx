"use client";
import { useId } from "react";
import type { Archetype, CastMember } from "@/lib/data";

const SKINS = ["#f7dcc4", "#eec39f", "#d39c6e", "#a86f47", "#6f4731"] as const;
const HAIRS = ["#1d1414", "#3b241a", "#6b3d21", "#a4552a", "#d9a441", "#ece4d4", "#7d1f1f"] as const;

/** Front hair shapes: side-swept, slicked back, big volume, cropped. */
const HAIR_FRONT = [
  "M31 41 C29 22 44 15 55 17 C67 19 71 29 69 39 C64 30 56 28 48 31 C42 33 36 36 31 41 Z",
  "M31 38 C32 23 40 17 50 17 C60 17 68 23 69 38 C66 29 58 26 50 26 C42 26 34 29 31 38 Z",
  "M27 46 C23 19 40 11 50 12 C62 11 79 19 73 46 C71 30 61 25 50 26 C39 25 29 30 27 46 Z",
  "M32 35 C34 24 42 20 50 20 C58 20 66 24 68 35 C62 30 56 28 50 28 C44 28 38 30 32 35 Z",
] as const;
const LONG_BACK = [true, false, true, false] as const;

type Mouth = "smirk" | "smile" | "flat" | "frown" | "gasp";
type Brows = "angry" | "raised" | "flat" | "sad";

/** The face an archetype pulls when the camera finds it. */
const EXPRESSIONS: Record<Archetype, { mouth: Mouth; brows: Brows }> = {
  "The Tycoon": { mouth: "flat", brows: "flat" },
  "The Amnesiac": { mouth: "gasp", brows: "raised" },
  "The Twin": { mouth: "gasp", brows: "raised" },
  "The Villain": { mouth: "smirk", brows: "angry" },
  "The Widow": { mouth: "frown", brows: "sad" },
  "The Ingenue": { mouth: "smile", brows: "raised" },
  "The Schemer": { mouth: "smirk", brows: "angry" },
  "The Oracle": { mouth: "smile", brows: "flat" },
  "The Gambler": { mouth: "frown", brows: "sad" },
  "The Newcomer": { mouth: "smile", brows: "flat" },
};

const MOUTHS: Record<Exclude<Mouth, "gasp">, string> = {
  smile: "M43 55 Q50 61 57 55",
  smirk: "M43 56 Q51 59 57 52",
  flat: "M44 56 L56 56",
  frown: "M43 59 Q50 53 57 59",
};

const BROWS: Record<Brows, [string, string]> = {
  angry: ["M39 33 L47 36.5", "M61 33 L53 36.5"],
  raised: ["M39 34 Q43.5 29.5 48 32.5", "M52 32.5 Q56.5 29.5 61 34"],
  flat: ["M39.5 34 L47.5 34", "M52.5 34 L60.5 34"],
  sad: ["M39 36.5 L47 33.5", "M61 36.5 L53 33.5"],
};

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function darken(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const f = 1 - amount;
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r} ${g} ${b})`;
}

/**
 * A generated soap headshot. Skin, hair, glasses and the beauty mark come from the address hash;
 * the expression comes from the archetype; the wardrobe from the character's hue.
 */
export function Portrait({ member, className }: { member: CastMember; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { address, character } = member;
  const h = hash(address);
  const skin = SKINS[h % SKINS.length] ?? SKINS[0];
  const hair = HAIRS[(h >>> 3) % HAIRS.length] ?? HAIRS[0];
  const style = (h >>> 6) % HAIR_FRONT.length;
  const glasses = ((h >>> 9) & 3) === 0;
  const mark = ((h >>> 11) & 3) === 0;
  const she = character.pronoun === "she";
  const { mouth, brows } = EXPRESSIONS[character.archetype];
  const hue = character.hue;
  const shade = darken(skin, 0.18);
  const lip = she ? "#c2274b" : darken(skin, 0.32);

  return (
    <svg
      viewBox="0 0 100 100"
      className={`portrait${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={`${character.name}, ${character.archetype}`}
    >
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="30%" r="75%">
          <stop offset="0" stopColor={`hsl(${hue} 85% 84%)`} />
          <stop offset="1" stopColor={`hsl(${hue} 62% 50%)`} />
        </radialGradient>
        <radialGradient id={`${id}-vig`} cx="50%" cy="45%" r="70%">
          <stop offset="0.55" stopColor="#2a1a22" stopOpacity="0" />
          <stop offset="1" stopColor="#2a1a22" stopOpacity="0.4" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <rect width="100" height="100" rx="18" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="100" height="100" fill={`url(#${id}-bg)`} />
        <ellipse cx="28" cy="18" rx="30" ry="16" fill="#fff" opacity="0.2" />
        {LONG_BACK[style] ? <path d="M29 50 C24 68 25 90 29 100 L71 100 C75 90 76 68 71 50 Z" fill={hair} /> : null}
        <path d="M8 100 C10 80 30 73 50 73 C70 73 90 80 92 100 Z" fill={`hsl(${hue} 55% 36%)`} />
        <path d="M39 74 L50 93 L61 74 Z" fill="#fff8fb" />
        <path d="M36 73 L50 96 L64 73" fill="none" stroke={`hsl(${hue} 50% 24%)`} strokeWidth="3" strokeLinejoin="round" />
        {she ? (
          <path d="M41 78 Q50 87 59 78" fill="none" stroke="#f5c518" strokeWidth="1.6" />
        ) : (
          <path d="M50 76 L46.5 81 L50 94 L53.5 81 Z" fill={`hsl(${hue} 75% 28%)`} />
        )}
        <rect x="43" y="56" width="14" height="21" rx="6" fill={shade} />
        <circle cx="32" cy="45" r="4.2" fill={skin} />
        <circle cx="68" cy="45" r="4.2" fill={skin} />
        <ellipse cx="50" cy="44" rx="18" ry="21" fill={skin} />
        <path d={HAIR_FRONT[style] ?? HAIR_FRONT[0]} fill={hair} />
        <g stroke={hair} strokeWidth="2" strokeLinecap="round" fill="none">
          <path d={BROWS[brows][0]} />
          <path d={BROWS[brows][1]} />
        </g>
        <ellipse cx="44" cy="41.5" rx="3.3" ry="3.7" fill="#fff" />
        <ellipse cx="56" cy="41.5" rx="3.3" ry="3.7" fill="#fff" />
        <circle cx="44.6" cy="42" r="1.9" fill="#2a1a22" />
        <circle cx="56.6" cy="42" r="1.9" fill="#2a1a22" />
        <circle cx="45.4" cy="41" r="0.7" fill="#fff" />
        <circle cx="57.4" cy="41" r="0.7" fill="#fff" />
        {she ? (
          <g stroke="#2a1a22" strokeWidth="1.1" fill="none" strokeLinecap="round">
            <path d="M40.5 39.5 Q44 37 47.5 39.5" />
            <path d="M52.5 39.5 Q56 37 59.5 39.5" />
          </g>
        ) : null}
        {glasses ? (
          <g fill="none" stroke="#2a1a22" strokeWidth="1.2">
            <rect x="38.5" y="37.5" width="11" height="8.5" rx="3" />
            <rect x="50.5" y="37.5" width="11" height="8.5" rx="3" />
            <path d="M49.5 41.5 L50.5 41.5" />
          </g>
        ) : null}
        <path d="M50 43 L48 49.5 L52 49.5" fill="none" stroke={shade} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {mouth === "gasp" ? (
          <ellipse cx="50" cy="56.5" rx="3.4" ry="4.4" fill="#5a1d2a" />
        ) : (
          <path d={MOUTHS[mouth]} fill="none" stroke={lip} strokeWidth="2.2" strokeLinecap="round" />
        )}
        {mark ? <circle cx="57.5" cy="52" r="1" fill="#2a1a22" /> : null}
        {she ? (
          <>
            <circle cx="32" cy="51.5" r="2.3" fill="#f5c518" />
            <circle cx="68" cy="51.5" r="2.3" fill="#f5c518" />
          </>
        ) : null}
        <rect width="100" height="100" fill={`url(#${id}-vig)`} />
      </g>
      <rect x="1" y="1" width="98" height="98" rx="17" fill="none" stroke="#f5c518" strokeWidth="2" opacity="0.9" />
    </svg>
  );
}
