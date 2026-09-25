"use client";
import { useId } from "react";
import { type Arms, type Charge, armsOf } from "@/lib/heraldry";

/** Heater shield in a 100 x 120 box. Every crest is clipped to this. */
export const SHIELD_PATH = "M10 8 H90 V60 C90 86 70 104 50 116 C30 104 10 86 10 60 Z";

interface Props {
  address: string;
  /** Rendered width in px; the shield keeps a 5:6 ratio. */
  size?: number;
  className?: string;
  /** Accessible name; defaults to the blazon. */
  title?: string;
}

const star = (points: number, outer: number, inner: number): string =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");

const MULLET = star(5, 23, 9.5);
const MANE = star(12, 24, 18);

function Field({ arms }: { arms: Arms }) {
  const a = arms.first.hex;
  const b = arms.second.hex;
  switch (arms.partition) {
    case "per pale":
      return (
        <>
          <rect x="0" y="0" width="50" height="120" fill={a} />
          <rect x="50" y="0" width="50" height="120" fill={b} />
        </>
      );
    case "per fess":
      return (
        <>
          <rect x="0" y="0" width="100" height="60" fill={a} />
          <rect x="0" y="60" width="100" height="60" fill={b} />
        </>
      );
    case "quarterly":
      return (
        <>
          <rect x="0" y="0" width="100" height="120" fill={b} />
          <rect x="0" y="0" width="50" height="60" fill={a} />
          <rect x="50" y="60" width="50" height="60" fill={a} />
        </>
      );
    case "per chevron":
      return (
        <>
          <rect x="0" y="0" width="100" height="120" fill={a} />
          <path d="M0 120 V82 L50 50 L100 82 V120 Z" fill={b} />
        </>
      );
  }
}

/** The charge, drawn from simple shapes, centred on (0,0) within roughly +-24. */
function ChargeShape({ charge, fill, stroke }: { charge: Charge; fill: string; stroke: string }) {
  const common = { fill, stroke, strokeWidth: 1.6, strokeLinejoin: "round" as const };
  switch (charge) {
    case "star":
      return <polygon points={MULLET} {...common} />;
    case "cross":
      return <path d="M-6 -24 L6 -24 L3 -4 L23 -6 L23 6 L3 4 L6 24 L-6 24 L-3 4 L-23 6 L-23 -6 L-3 -4 Z" {...common} />;
    case "crescent":
      return <path d="M-18 -8 A20 20 0 1 0 18 -8 A19 19 0 0 1 -18 -8 Z" {...common} />;
    case "chevron":
      return <path d="M-22 12 L0 -12 L22 12 L22 22 L0 -2 L-22 22 Z" {...common} />;
    case "tower":
      return (
        <>
          <path d="M-13 22 V-16 H-7 V-8 H-3 V-16 H3 V-8 H7 V-16 H13 V22 Z" {...common} />
          <path d="M-4 22 V12 A4 4 0 0 1 4 12 V22 Z" fill={stroke} />
          <rect x="-2" y="-2" width="4" height="6" fill={stroke} />
        </>
      );
    case "key":
      return (
        <>
          <path d="M-10 -12 A10 10 0 1 0 10 -12 A10 10 0 1 0 -10 -12 Z M-4 -12 A4 4 0 1 1 4 -12 A4 4 0 1 1 -4 -12 Z" fillRule="evenodd" {...common} />
          <path d="M-2.5 -3 H2.5 V12 H10.5 V16 H2.5 V19 H8.5 V23 H2.5 V24 H-2.5 Z" {...common} />
        </>
      );
    case "sword":
      return (
        <>
          <path d="M0 -25 L4 -18 V6 H13 V10 H4 V20 H-4 V10 H-13 V6 H-4 V-18 Z" {...common} />
          <circle cx="0" cy="23" r="3.5" {...common} />
        </>
      );
    case "lion":
      return (
        <>
          <polygon points={MANE} {...common} />
          <circle cx="-9" cy="-11" r="3.6" {...common} />
          <circle cx="9" cy="-11" r="3.6" {...common} />
          <circle cx="0" cy="0" r="13" {...common} />
          <circle cx="-4.6" cy="-3" r="1.9" fill={stroke} />
          <circle cx="4.6" cy="-3" r="1.9" fill={stroke} />
          <path d="M-3.2 2.4 H3.2 L0 6.4 Z" fill={stroke} />
          <path d="M-5 8 Q0 11.5 5 8" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
  }
}

/**
 * A coat of arms generated from the address: partition, two tinctures, a charge and (sometimes)
 * a bordure are all bit fields of its hash. Same address, same arms, on every page.
 */
export function Crest({ address, size = 56, className, title }: Props) {
  const arms = armsOf(address);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clipId = `crest-clip-${uid}`;
  const sheenId = `crest-sheen-${uid}`;
  const metalHex = arms.first.kind === "metal" ? arms.first.hex : arms.second.hex;
  const colourHex = arms.first.kind === "colour" ? arms.first.hex : arms.second.hex;
  const chargeStroke = arms.chargeTincture.kind === "metal" ? colourHex : metalHex;
  const bordureHex = arms.second.kind === "metal" ? colourHex : metalHex;

  return (
    <svg
      className={`crest${className ? ` ${className}` : ""}`}
      width={size}
      height={(size * 6) / 5}
      viewBox="0 0 100 120"
      role="img"
      aria-label={title ?? arms.blazon}
      data-partition={arms.partition}
      data-charge={arms.charge}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={SHIELD_PATH} />
        </clipPath>
        <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <Field arms={arms} />
        {arms.bordure ? <path d={SHIELD_PATH} fill="none" stroke={bordureHex} strokeWidth="7" /> : null}
        <g transform="translate(50 60)">
          <ChargeShape charge={arms.charge} fill={arms.chargeTincture.hex} stroke={chargeStroke} />
        </g>
        <path d={SHIELD_PATH} fill={`url(#${sheenId})`} />
      </g>
      <path className="crest__rim" d={SHIELD_PATH} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  );
}
