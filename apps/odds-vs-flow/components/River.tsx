"use client";
import { NansenLink } from "@longitude/kit";
import { Grow, NumberTicker, fmt, useReducedMotion } from "@longitude/motion";
import { type CSSProperties, useMemo } from "react";
import type { Bout } from "@/lib/data";

/**
 * Native-coin stand-ins (0xeee…/0x000… on EVM chains, the all-ones addresses on Solana) are not contracts
 * Token God Mode can open, so those rivers get no Nansen link. Real contracts (WBTC, WETH, the wrapped SOL
 * mint) do.
 */
const NATIVE_PLACEHOLDER = /^(?:0x(?:e{40}|0{40})|1{32}|So1{41})$/i;
const godModeReady = (t: Bout["token"]): boolean => Boolean(t.address && t.chain) && !NATIVE_PLACEHOLDER.test(t.address);

/* The water is drawn twice as wide as its box and slid one width per loop, so it never seams. */
const VW = 800;
const VH = 220;

interface Layer {
  amp: number;
  /** Must divide VW so the loop is seamless. */
  wl: number;
  base: number;
  fill: string;
  opacity: number;
  /** Multiplier on the bout's drift duration; far layers move slower. */
  speed: number;
  bobSeconds: number;
}

const LAYERS: readonly Layer[] = [
  { amp: 5, wl: 200, base: 84, fill: "#9cc0e6", opacity: 0.55, speed: 1.9, bobSeconds: 4.6 },
  { amp: 8, wl: 160, base: 114, fill: "#5f8fcb", opacity: 0.78, speed: 1.45, bobSeconds: 3.9 },
  { amp: 11, wl: 100, base: 146, fill: "#2a5c9c", opacity: 0.92, speed: 1.1, bobSeconds: 3.3 },
  { amp: 14, wl: 80, base: 180, fill: "#143a68", opacity: 1, speed: 0.85, bobSeconds: 2.8 },
];

function crest(l: Layer): string {
  let d = `M 0 ${l.base}`;
  for (let x = 0; x < VW * 2; x += l.wl) {
    d += ` Q ${x + l.wl / 4} ${l.base - l.amp} ${x + l.wl / 2} ${l.base} Q ${x + (3 * l.wl) / 4} ${l.base + l.amp} ${x + l.wl} ${l.base}`;
  }
  return d;
}

const wave = (l: Layer): string => `${crest(l)} L ${VW * 2} ${VH} L 0 ${VH} Z`;

/** Glints on the water, placed from the token address so each river is its own. */
function motesOf(seed: string): { x: number; y: number; r: number }[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const next = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
  return Array.from({ length: 7 }, () => ({ x: Math.round(next() * VW), y: Math.round(100 + next() * 90), r: 1.5 + next() * 2 }));
}

/** Loop duration for the front layer: a flat flow barely drifts, a billion-dollar week races. */
const driftSeconds = (strength: number): number => 18 - 15 * strength;

/**
 * Smart money as water. Wave speed follows the log-scaled 7-day net flow, direction follows its
 * sign (buying flows in toward the rope, selling drains out), and the readout carries the numbers.
 */
export function River({ bout: b }: { bout: Bout }) {
  const reduce = useReducedMotion();
  const t = b.token;
  const motes = useMemo(() => motesOf(t.address), [t.address]);
  const style = {
    "--river-dur": `${driftSeconds(b.flow.strength).toFixed(2)}s`,
    "--river-dir": b.flow.stance === "selling" ? "reverse" : "normal",
  } as CSSProperties;
  const direction = b.flow.stance === "buying" ? "◀ flowing in" : b.flow.stance === "selling" ? "draining out ▶" : "still water";

  return (
    <div className={`river river--${b.flow.stance}${reduce ? " river--still" : ""}`} style={style}>
      <svg className="river__water" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" aria-hidden="true">
        {LAYERS.map((l, i) => (
          <g key={l.base} className="river__drift" style={{ animationDuration: `calc(var(--river-dur) * ${l.speed})` }}>
            <g className="river__bob" style={{ animationDuration: `${l.bobSeconds}s`, animationDelay: `${-i * 0.9}s` }}>
              <path d={wave(l)} fill={l.fill} opacity={l.opacity} />
              {i >= 1 ? <path d={crest(l)} className="river__crest" /> : null}
            </g>
          </g>
        ))}
        <g className="river__drift river__motes" style={{ animationDuration: "calc(var(--river-dur) * 0.7)" }}>
          {motes.map((m, i) =>
            [0, VW].map((offset) => <circle key={`${i}-${offset}`} cx={m.x + offset} cy={m.y} r={m.r} />),
          )}
        </g>
      </svg>

      <div className="river__readout">
        <span className="river__kicker">
          Smart money · {t.symbol} · {t.chain}
        </span>
        <div className="river__headline">
          <b className={`river__flow river__flow--${b.flow.stance}`}>
            <NumberTicker value={t.netFlow7dUsd} format={fmt.usdSigned} duration={1.6} />
          </b>
          {godModeReady(t) ? <NansenLink address={t.address} chain={t.chain} kind="token" /> : null}
        </div>
        <span className="river__label">7-day net flow · {b.flow.stance}</span>
        <dl className="river__stats">
          <div>
            <dt>24h</dt>
            <dd>{fmt.usdSigned(t.netFlow24hUsd)}</dd>
          </div>
          <div>
            <dt>30d</dt>
            <dd>{fmt.usdSigned(t.netFlow30dUsd)}</dd>
          </div>
          <div>
            <dt>Traders</dt>
            <dd>{fmt.int(t.traderCount)}</dd>
          </div>
          <div>
            <dt>Mkt cap</dt>
            <dd>{fmt.usd(t.marketCapUsd)}</dd>
          </div>
        </dl>
        <div className="river__current">
          <span>current</span>
          <div className="river__gauge">
            <Grow percent={b.flow.strength * 100} className="river__gaugefill" spring="gentle" delay={0.3} />
          </div>
          <span>{b.flow.strength.toFixed(2)}</span>
        </div>
      </div>
      <span className="river__dir">{direction}</span>
    </div>
  );
}
