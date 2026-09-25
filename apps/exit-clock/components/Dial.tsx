"use client";
import { useEffect, useState } from "react";
import { HOUR_MS, OVERDUE_SWEEP_DEG, SCALE_MARKS, hoursToAngle, remainingMs } from "@/lib/clock";
import type { ExitToken, Holder } from "@/lib/data";

/* Face geometry, in viewBox units. 12 o'clock is now. */
const C = 200;
const R_BEZEL = 198;
const R_FACE = 184;
const R_TICK_OUT = 181;
const R_TICK_MAJOR = 165;
const R_TICK_MINOR = 172;
const R_LABEL = 150;
const HAND_MAX = 162;
const HAND_MIN = 50;
const SUB_Y = 268;
const SUB_R = 30;

const f = (n: number): string => n.toFixed(2);

function polar(r: number, deg: number, cy = C): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  return `M${f(x0)} ${f(y0)} A${r} ${r} 0 0 1 ${f(x1)} ${f(y1)}`;
}

function wedge(rOut: number, rIn: number, a0: number, a1: number): string {
  const [ox0, oy0] = polar(rOut, a0);
  const [ox1, oy1] = polar(rOut, a1);
  const [ix1, iy1] = polar(rIn, a1);
  const [ix0, iy0] = polar(rIn, a0);
  return `M${f(ox0)} ${f(oy0)} A${rOut} ${rOut} 0 0 1 ${f(ox1)} ${f(oy1)} L${f(ix1)} ${f(iy1)} A${rIn} ${rIn} 0 0 0 ${f(ix0)} ${f(iy0)} Z`;
}

/** A tapered hand pointing at 12, with a short counterweight past the hub. Rotated by CSS. */
function handPath(len: number, w: number): string {
  return `M${C} ${f(C - len)} L${f(C + w)} ${C - 14} L${f(C + w * 0.7)} ${C + 18} L${f(C - w * 0.7)} ${C + 18} L${f(C - w)} ${C - 14} Z`;
}

/** False on the first paint after `key` changes, true a frame later, so the hands fan out from 12 o'clock. */
function useSettled(key: string, skip: boolean): boolean {
  const [settled, setSettled] = useState(skip);
  useEffect(() => {
    if (skip) {
      setSettled(true);
      return;
    }
    setSettled(false);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSettled(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [key, skip]);
  return settled;
}

interface Props {
  token: ExitToken;
  holders: Holder[];
  now: number;
  active: string | null;
  reduce: boolean;
  /** Addresses on this token the visitor is watching: they get a brass pin through the hand. */
  watched: Set<string>;
  onSelect: (address: string) => void;
  onHover: (address: string | null) => void;
}

export function Dial({ token, holders, now, active, reduce, watched, onSelect, onHover }: Props) {
  const settled = useSettled(token.address, reduce);
  // Running seconds for the subdial: a monotonic count, so the needle never unwinds at :59 → :00.
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    setTicks((t) => t + 1);
  }, [now]);

  const maxValue = Math.max(1, ...holders.map((h) => h.valueUsd));
  const hands = holders.map((h) => {
    const ms = remainingMs(h.expectedExitAt, now);
    const t = Math.max(0, h.valueUsd) / maxValue;
    return { h, angle: hoursToAngle(ms / HOUR_MS), len: HAND_MIN + (HAND_MAX - HAND_MIN) * t, w: 2.4 + 3.4 * t, overdue: ms <= 0 };
  });
  // Paint order: plain hands (longest first so short ones stay visible), then overdue, then the active one on top.
  const rank = (x: (typeof hands)[number]): number => (x.h.address === active ? 3 : x.overdue ? 2 : 1);
  const ordered = [...hands].sort((a, b) => rank(a) - rank(b) || b.len - a.len);
  const overdueCount = hands.filter((x) => x.overdue).length;
  const secondsAngle = reduce ? 0 : ticks * 6;

  return (
    <svg className="dial__svg" viewBox="0 0 400 400" role="img" aria-label={`${token.symbol}: ${holders.length} smart money hands, ${overdueCount} overdue, ${watched.size} watched`}>
      <defs>
        <radialGradient id="face" cx="50%" cy="42%" r="62%">
          <stop offset="0" stopColor="#5d5d57" />
          <stop offset="0.7" stopColor="#3f3f3a" />
          <stop offset="1" stopColor="#30302c" />
        </radialGradient>
        <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcbc7a" />
          <stop offset="0.5" stopColor="#a67f49" />
          <stop offset="1" stopColor="#6a4f27" />
        </linearGradient>
        <linearGradient id="hand-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#dcd8cd" />
          <stop offset="0.5" stopColor="#aaa69c" />
          <stop offset="1" stopColor="#77746b" />
        </linearGradient>
        <linearGradient id="hand-brass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f3d99f" />
          <stop offset="0.5" stopColor="#c99e5c" />
          <stop offset="1" stopColor="#85622d" />
        </linearGradient>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="rgba(176,141,87,0.16)" />
          <rect width="2" height="6" fill="rgba(226,192,127,0.55)" />
        </pattern>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.16 0" />
        </filter>
        <clipPath id="face-clip">
          <circle cx={C} cy={C} r={R_FACE} />
        </clipPath>
      </defs>

      {/* Bezel */}
      <circle cx={C} cy={C} r={R_BEZEL} fill="url(#bezel)" />
      <circle cx={C} cy={C} r={R_BEZEL} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="1.5" />
      {[45, 135, 225, 315].map((deg) => {
        const [x, y] = polar(191, deg);
        return (
          <g key={deg} transform={`rotate(${deg} ${f(x)} ${f(y)})`}>
            <circle cx={f(x)} cy={f(y)} r="3.2" fill="url(#bezel)" stroke="rgba(0,0,0,0.6)" strokeWidth="0.8" />
            <line x1={f(x - 1.9)} y1={f(y)} x2={f(x + 1.9)} y2={f(y)} stroke="rgba(0,0,0,0.65)" strokeWidth="0.9" />
          </g>
        );
      })}

      {/* Concrete face */}
      <circle cx={C} cy={C} r={R_FACE} fill="url(#face)" />
      <rect x="0" y="0" width="400" height="400" filter="url(#grain)" clipPath="url(#face-clip)" pointerEvents="none" />
      <circle cx={C} cy={C} r={R_FACE - 3} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="6" />
      <circle cx={C} cy={C} r={R_FACE + 0.5} fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth="1.5" />

      {/* Overdue wedge: the 30° before 12 */}
      <path className="dial__wedge" d={wedge(R_TICK_OUT, R_TICK_MAJOR - 2, -OVERDUE_SWEEP_DEG, 0)} />
      <path id="wedge-arc" d={arc(R_LABEL + 1, -OVERDUE_SWEEP_DEG + 2, -2)} fill="none" />
      <text className="dial__wedge-label">
        <textPath href="#wedge-arc" startOffset="50%" textAnchor="middle">
          OVERDUE
        </textPath>
      </text>

      {/* Engraved scale */}
      {SCALE_MARKS.map((m) => {
        const a = hoursToAngle(m.hours);
        const major = Boolean(m.label);
        const [x1, y1] = polar(R_TICK_OUT, a);
        const [x2, y2] = polar(major ? R_TICK_MAJOR : R_TICK_MINOR, a);
        const [lx, ly] = polar(R_LABEL, a);
        return (
          <g key={m.hours}>
            <line className={major ? "dial__tick dial__tick--major" : "dial__tick"} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} />
            {m.label ? (
              <text className="dial__label" x={f(lx)} y={f(ly)} textAnchor="middle" dominantBaseline="middle">
                {m.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Now: the notch at 12 and a hairline down to the hub */}
      <line x1={C} y1={C} x2={C} y2={C - R_TICK_OUT} stroke="rgba(226,192,127,0.28)" strokeWidth="1" strokeDasharray="2 3" />
      <path d={`M${C - 7} 3 L${C + 7} 3 L${C} 19 Z`} fill="#f0d59a" stroke="rgba(0,0,0,0.5)" strokeWidth="0.8" />
      <text className="dial__caps" x={C} y={44} textAnchor="middle">
        NOW
      </text>
      <text className="dial__caps" x={C} y={116} textAnchor="middle">
        EXIT CLOCK
      </text>

      {/* Running seconds subdial */}
      <circle cx={C} cy={SUB_Y} r={SUB_R} fill="#2b2b28" stroke="rgba(0,0,0,0.65)" strokeWidth="1.2" />
      <circle cx={C} cy={SUB_Y} r={SUB_R - 1.5} fill="none" stroke="rgba(226,192,127,0.28)" strokeWidth="0.6" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = i * 30;
        const big = i % 3 === 0;
        const [x1, y1] = polar(SUB_R - 3, a, SUB_Y);
        const [x2, y2] = polar(SUB_R - (big ? 8 : 5.5), a, SUB_Y);
        return <line key={i} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke={big ? "#e2c07f" : "rgba(242,239,230,0.45)"} strokeWidth={big ? 1.4 : 0.8} />;
      })}
      <text className="dial__caps dial__caps--tiny" x={C} y={SUB_Y + 15} textAnchor="middle">
        SEC
      </text>
      <g className="dial__sec" style={{ transform: `rotate(${secondsAngle}deg)` }}>
        <line x1={C} y1={SUB_Y + 6} x2={C} y2={SUB_Y - SUB_R + 5} stroke="#f0d59a" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx={C} cy={SUB_Y} r="2" fill="#f0d59a" />
      </g>

      {/* Hands: one per holder */}
      {ordered.map(({ h, angle, len, w, overdue }) => {
        const isActive = active === h.address;
        const dim = active !== null && !isActive;
        const isWatched = watched.has(h.address);
        const cls = `dial__hand${overdue ? " dial__hand--overdue" : ""}${isActive ? " dial__hand--active" : ""}${dim ? " dial__hand--dim" : ""}${isWatched ? " dial__hand--watched" : ""}`;
        return (
          <g
            key={h.address}
            className={cls}
            style={{ transform: `rotate(${settled ? angle : 0}deg)` }}
            onPointerEnter={() => onHover(h.address)}
            onPointerLeave={() => onHover(null)}
            onClick={() => onSelect(h.address)}
          >
            <g className="dial__hand-body">
              {overdue ? <path className="dial__hand-glow" d={handPath(len, w + 1.6)} /> : null}
              <path className="dial__hand-fill" d={handPath(len, w)} />
              {overdue ? <circle cx={C} cy={f(C - len)} r="2.4" fill="#f3d99f" stroke="#4a3517" strokeWidth="0.5" /> : null}
              {isWatched ? (
                <g className="dial__pin">
                  <circle cx={C} cy={f(C - len + 11)} r="6.5" fill="none" stroke="rgba(243,217,159,0.55)" strokeWidth="0.8" />
                  <circle cx={C} cy={f(C - len + 11)} r="4" fill="#f3d99f" stroke="#4a3517" strokeWidth="0.7" />
                  <circle cx={C} cy={f(C - len + 11)} r="1.4" fill="#2a2a28" />
                </g>
              ) : null}
              <path className="dial__hit" d={`M${C} ${f(C - len - 4)} L${C} ${C + 16}`} stroke="transparent" strokeWidth="14" fill="none" pointerEvents="all" />
            </g>
          </g>
        );
      })}

      {/* Hub: a brass screw head */}
      <circle cx={C} cy={C} r="12" fill="url(#bezel)" stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
      <circle cx={C} cy={C} r="4.5" fill="#2a2a28" />
      <line x1={C - 3} y1={C} x2={C + 3} y2={C} stroke="#e2c07f" strokeWidth="1" />

      {holders.length === 0 ? (
        <text className="dial__label" x={C} y={C - 44} textAnchor="middle" dominantBaseline="middle">
          NO SMART MONEY HOLDERS
        </text>
      ) : null}
    </svg>
  );
}
