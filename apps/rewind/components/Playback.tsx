"use client";
import { AnimatePresence, NumberTicker, animate, fmt, motion, springs, useMotionValue, useReducedMotion, useTransform } from "@longitude/motion";
import { type CSSProperties, useEffect, useMemo } from "react";
import { HOLD_DAYS, type Tape, dayOffset, pctFrom } from "@/lib/data";
import { DRAW_SECONDS, type Phase, pickColor } from "./shared";

const W = 640;
const H = 300;
const PAD = { l: 50, r: 108, t: 26, b: 30 };
const X0 = PAD.l;
const X1 = W - PAD.r;
const Y0 = PAD.t;
const Y1 = H - PAD.b;

interface Series {
  symbol: string;
  color: string;
  d: string;
  end: { x: number; y: number };
  labelY: number;
  returnPct: number;
  isWinner: boolean;
}

function niceStep(range: number): number {
  const target = range / 4;
  return [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((s) => s >= target) ?? 1000;
}

/** Push overlapping end labels apart, top to bottom. */
function spread(ys: number[], gap = 16): number[] {
  const out = ys.slice();
  let prev = Number.NEGATIVE_INFINITY;
  for (const { y, i } of ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)) {
    const v = Math.min(H - 8, Math.max(y, prev + gap));
    out[i] = v;
    prev = v;
  }
  return out;
}

/** Every path as percent against its own entry price, so four tokens share one axis. */
function buildSeries(tape: Tape) {
  const pct = tape.picks.map((p) => p.path.map((pt) => ({ day: dayOffset(tape.date, pt.t), pct: pctFrom(p, pt.close) })));
  const all = pct.flat().map((v) => v.pct).filter(Number.isFinite);
  let lo = Math.min(0, ...all);
  let hi = Math.max(0, ...all);
  const pad = Math.max(3, (hi - lo) * 0.12);
  lo -= pad;
  hi += pad;
  const y = (v: number) => Y1 - ((v - lo) / (hi - lo)) * (Y1 - Y0);
  const x = (day: number) => X0 + (Math.max(0, Math.min(HOLD_DAYS, day)) / HOLD_DAYS) * (X1 - X0);
  const step = niceStep(hi - lo);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const ends = pct.map((pts) => pts[pts.length - 1]);
  const labelYs = spread(ends.map((e) => (e ? y(e.pct) : y(0))));
  const series: Series[] = tape.picks.map((p, i) => {
    const pts = pct[i] ?? [];
    const end = ends[i];
    return {
      symbol: p.symbol,
      color: pickColor(i),
      d: pts.map((pt, j) => `${j === 0 ? "M" : "L"}${x(pt.day).toFixed(1)} ${y(pt.pct).toFixed(1)}`).join(" "),
      end: end ? { x: x(end.day), y: y(end.pct) } : { x: X0, y: y(0) },
      labelY: labelYs[i] ?? y(0),
      returnPct: p.returnPct30d,
      isWinner: p.symbol === tape.winner,
    };
  });
  return { series, ticks, y, x };
}

interface Props {
  tape: Tape;
  phase: Phase;
  call: string | null;
}

/** The TV: static until PLAY, then the four price paths draw in, the returns roll, and the verdict lands. */
export function Playback({ tape, phase, call }: Props) {
  const reduce = useReducedMotion();
  const { series, ticks, y, x } = useMemo(() => buildSeries(tape), [tape]);
  const rolling = phase === "playing" || phase === "revealed";
  const revealed = phase === "revealed";
  const draw = reduce ? 0 : DRAW_SECONDS;
  const winner = tape.picks.find((p) => p.symbol === tape.winner);
  const called = call ? tape.picks.find((p) => p.symbol === call) : undefined;
  const hit = Boolean(call && call === tape.winner);

  // The on-screen day counter rolls D+00 → D+30 with the playhead.
  const day = useMotionValue(0);
  useEffect(() => {
    if (phase === "playing") {
      const controls = animate(day, HOLD_DAYS, { duration: draw + 0.3, ease: "linear" });
      return () => controls.stop();
    }
    day.set(phase === "revealed" ? HOLD_DAYS : 0);
  }, [phase, day, draw]);
  const dayText = useTransform(day, (v) => `D+${String(Math.round(v)).padStart(2, "0")}`);

  return (
    <div className="tv__set">
      <div className="tv__bezel">
        <div className={`screen screen--${phase}`}>
          <svg className="screen__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`30-day price paths for ${series.map((s) => s.symbol).join(", ")}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={X0} x2={X1} y1={y(t)} y2={y(t)} className={t === 0 ? "chart__zero" : "chart__grid"} />
                <text x={X0 - 8} y={y(t) + 3} textAnchor="end" className="chart__tick">
                  {t > 0 ? `+${t}%` : `${t}%`}
                </text>
              </g>
            ))}
            {[0, 10, 20, 30].map((d) => (
              <text key={d} x={x(d)} y={H - 10} textAnchor="middle" className="chart__tick">
                {d === 0 ? "day 0" : `+${d}d`}
              </text>
            ))}
            {series.map((s, i) => (
              <motion.path
                key={`${tape.date}:${s.symbol}`}
                d={s.d}
                className={`chart__path${s.symbol === call ? " is-call" : ""}${revealed ? (s.isWinner ? " is-winner" : " is-loser") : ""}`}
                style={{ color: s.color }}
                stroke="currentColor"
                initial={false}
                animate={{ pathLength: rolling ? 1 : 0 }}
                transition={rolling ? { duration: draw, delay: reduce ? 0 : i * 0.1, ease: "easeInOut" } : { duration: reduce ? 0 : 0.5, ease: "easeIn" }}
              />
            ))}
            {series.map((s, i) => (
              <motion.g
                key={`end:${tape.date}:${s.symbol}`}
                className="chart__end"
                style={{ color: s.color }}
                initial={false}
                animate={{ opacity: rolling ? 1 : 0 }}
                transition={{ duration: 0.3, delay: rolling ? draw + (reduce ? 0 : i * 0.1) : 0 }}
              >
                <circle cx={s.end.x} cy={s.end.y} r={4} />
                <text x={s.end.x + 9} y={s.labelY + 5}>
                  {s.symbol} {fmt.pctSigned(s.returnPct, 0)}
                </text>
              </motion.g>
            ))}
            <AnimatePresence>
              {phase === "playing" && !reduce ? (
                <motion.line
                  key="head"
                  className="chart__head"
                  x1={X0}
                  x2={X0}
                  y1={Y0}
                  y2={Y1}
                  initial={{ x: 0, opacity: 1 }}
                  animate={{ x: X1 - X0 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ duration: draw + 0.3, ease: "linear" }}
                />
              ) : null}
            </AnimatePresence>
          </svg>
          {!rolling ? <Noise animated={!reduce} /> : null}
          <div key={tape.date} className="screen__flash" aria-hidden="true" />
          <div className="screen__osd" aria-hidden="true">
            <span>{phase === "playing" ? "▶ PLAY" : phase === "revealed" ? "■ END" : phase === "locked" ? "● LOCKED" : "■ STOP"}</span>
            <motion.span>{dayText}</motion.span>
            <span>{tape.label.toUpperCase()} · SP</span>
          </div>
          {!rolling ? (
            <div className="screen__idle">{phase === "locked" ? "PRESS ▶ PLAY" : call ? "PRESS ● LOCK" : "PICK A CASSETTE"}</div>
          ) : null}
          <AnimatePresence>
            {revealed ? (
              <motion.div
                key="verdict"
                className={`verdict verdict--${hit ? "hit" : "miss"}`}
                role="status"
                initial={{ opacity: 0, y: 24, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
                transition={springs.snappy}
              >
                <span className="verdict__grade">{hit ? "HIT" : "MISS"}</span>
                <span className="verdict__text">
                  {winner ? `$${winner.symbol} ran ${fmt.pctSigned(winner.returnPct30d, 1)} in ${HOLD_DAYS} days.` : null}
                  {called && !hit ? ` Your $${called.symbol} did ${fmt.pctSigned(called.returnPct30d, 1)}.` : null}
                  {hit ? " You called it." : null}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <ul className="legend">
        {tape.picks.map((p, i) => (
          <li
            key={`${p.chain}:${p.address}`}
            className={`${revealed && p.symbol === tape.winner ? "is-winner" : ""}${p.symbol === call ? " is-call" : ""}`}
            style={{ "--tape-color": pickColor(i) } as CSSProperties}
          >
            <span className="legend__sym">${p.symbol}</span>
            {rolling ? (
              <NumberTicker className="legend__ret" value={p.returnPct30d} format={(n) => fmt.pctSigned(n, 1)} duration={2.2} />
            ) : (
              <span className="legend__ret is-idle">--.-%</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Real VHS static: turbulence noise, re-seeded a few times a second. Still when motion is reduced. */
function Noise({ animated }: { animated: boolean }) {
  return (
    <svg className="screen__noise" aria-hidden="true" focusable="false">
      <filter id="vhs-noise" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9 0.55" numOctaves="2" seed="3" stitchTiles="stitch">
          {animated ? <animate attributeName="seed" values="1;5;9;13;17;21;25;29" dur="0.7s" calcMode="discrete" repeatCount="indefinite" /> : null}
        </feTurbulence>
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 0.55" />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter="url(#vhs-noise)" />
    </svg>
  );
}
