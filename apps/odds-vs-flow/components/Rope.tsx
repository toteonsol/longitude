"use client";
import { motion, useReducedMotion, useSpring, useTime, useTransform } from "@longitude/motion";
import { useEffect } from "react";
import type { Relation } from "@/lib/data";
import { PickSide } from "./PickSide";

/* Stage geometry, in viewBox units. The crowd stands left, smart money right, the knot between. */
const W = 600;
const H = 172;
/** Rope height at the anchors (the front hands). */
const Y = 90;
const X0 = 112;
const X1 = W - X0;
const CENTER = W / 2;
/** How far the knot travels for |pull| = 1. */
const TRAVEL = 150;
/** Rope tail that runs through each team's hands. */
const TAIL = 92;
const FIGURE_GAP = 22;

/** Slack in the rope: a real contest keeps it taut; two sides pulling the same way let it hang. */
const SAG: Record<Relation, number> = { contested: 8, aligned: 28, unopposed: 17 };
/** Size of each side's heave, in pull units. */
const HEAVE: Record<Relation, number> = { contested: 0.06, aligned: 0.02, unopposed: 0.035 };

interface Props {
  /** -1 (crowd) .. 1 (smart money). */
  pull: number;
  relation: Relation;
  /** 0..1, how big each team is. */
  crowd: number;
  flow: number;
  crowdLabel: string;
  flowLabel: string;
  /** Polymarket market id: the social target for "pick a side" is `bout:<marketId>`. */
  marketId: string;
  question: string;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A yank then a rest: the positive half of a sine, squared. */
function heave(t: number, periodMs: number, phase: number): number {
  const s = Math.sin((t / periodMs) * Math.PI * 2 + phase);
  return s > 0 ? s * s : 0;
}

const teamSize = (strength: number): number => 1 + Math.round(strength * 3);

/** Two quadratic segments meeting at the knot; the longer side sags more, the knot is the low point. */
function ropePath(kx: number, ky: number, sag: number): string {
  const span = X1 - X0;
  const c1x = (X0 + kx) / 2;
  const c1y = (Y + ky) / 2 + (sag * (kx - X0)) / span;
  const c2x = (kx + X1) / 2;
  const c2y = (ky + Y) / 2 + (sag * (X1 - kx)) / span;
  return `M ${X0 - TAIL} ${Y} L ${X0} ${Y} Q ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${kx.toFixed(1)} ${ky.toFixed(1)} Q ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${X1} ${Y} L ${X1 + TAIL} ${Y}`;
}

/** A stick figure dug in and leaning away from the knot. `dir` is the way it faces. */
function Figure({ x, dir, tone }: { x: number; dir: 1 | -1; tone: "crowd" | "smart" }) {
  const feet = Y + 16;
  return (
    <g transform={`rotate(${-13 * dir} ${x} ${feet})`} className={`rope__figure rope__figure--${tone}`}>
      <line x1={x} y1={Y - 4} x2={x + 10 * dir} y2={feet} />
      <line x1={x} y1={Y - 4} x2={x - 6 * dir} y2={feet} />
      <line x1={x} y1={Y - 22} x2={x} y2={Y - 4} />
      <line x1={x} y1={Y - 17} x2={x + 15 * dir} y2={Y} />
      <circle cx={x} cy={Y - 29} r={6.5} />
      {tone === "crowd" ? (
        <path d={`M ${x - 8} ${Y - 32} h 16`} className="rope__cap" />
      ) : (
        <path d={`M ${x - 3} ${Y - 22} l 3 7 l 3 -7 z`} className="rope__tie" />
      )}
    </g>
  );
}

/**
 * The signature: the knot springs to `pull`, the rope sags by how contested the bout is, and each
 * side heaves on its own rhythm, scaled by its strength. Everything runs on motion values, so the
 * SVG updates without re-rendering. Tap the rope to run the tug again.
 */
export function Rope({ pull, relation, crowd, flow, crowdLabel, flowLabel, marketId, question }: Props) {
  const reduce = useReducedMotion();
  const spring = useSpring(0, { stiffness: 64, damping: 8.5, mass: 1.1 });
  useEffect(() => {
    if (reduce) spring.jump(pull);
    else spring.set(pull);
  }, [pull, reduce, spring]);

  const time = useTime();
  const amp = reduce ? 0 : HEAVE[relation];
  const sag = SAG[relation];
  const ky = Y + sag;

  const crowdHeave = useTransform(time, (t) => (amp ? heave(t, 1700, 0) * crowd : 0));
  const flowHeave = useTransform(time, (t) => (amp ? heave(t, 1300, 2.1) * flow : 0));
  const knotX = useTransform([spring, crowdHeave, flowHeave], (v: number[]) => {
    const p = (v[0] ?? 0) + amp * ((v[2] ?? 0) - (v[1] ?? 0));
    return CENTER + TRAVEL * clamp(p, -1.15, 1.15);
  });
  const ropeD = useTransform(knotX, (x) => ropePath(x, ky, sag));
  const crowdX = useTransform(crowdHeave, (h) => -9 * h);
  const flowX = useTransform(flowHeave, (h) => 9 * h);

  const replay = () => {
    if (reduce) return;
    spring.jump(0);
    requestAnimationFrame(() => spring.set(pull));
  };

  const label = pull > 0 ? `+${pull.toFixed(2)}` : pull < 0 ? `−${Math.abs(pull).toFixed(2)}` : "0.00";
  const leader = pull > 0.1 ? "smart money" : pull < -0.1 ? "the crowd" : "nobody";

  return (
    <div className={`rope rope--${relation}`}>
      <div className="rope__ends">
        <span className="rope__end rope__end--crowd">
          Crowd <small>{crowdLabel}</small>
        </span>
        <span className="rope__end rope__end--knot">
          <small>knot at</small> {label}
        </span>
        <span className="rope__end rope__end--smart">
          Smart money <small>{flowLabel}</small>
        </span>
      </div>
      <svg className="rope__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tug of war. Knot at ${label}: ${leader} pulling harder.`} onClick={replay}>
        <title>Tap to run the tug again</title>
        <line className="rope__ground" x1={20} y1={Y + 17} x2={W - 20} y2={Y + 17} />
        <line className="rope__center" x1={CENTER} y1={Y - 44} x2={CENTER} y2={Y + 44} />
        <text className="rope__even" x={CENTER} y={Y - 50}>
          even
        </text>

        <motion.path className="rope__shadow" d={ropeD} />
        <motion.path className="rope__line" d={ropeD} />
        <motion.path className="rope__twist" d={ropeD} />

        <motion.g style={{ x: crowdX }}>
          {Array.from({ length: teamSize(crowd) }, (_, i) => (
            <Figure key={i} x={X0 - 16 - i * FIGURE_GAP} dir={1} tone="crowd" />
          ))}
        </motion.g>
        <motion.g style={{ x: flowX }}>
          {Array.from({ length: teamSize(flow) }, (_, i) => (
            <Figure key={i} x={X1 + 16 + i * FIGURE_GAP} dir={-1} tone="smart" />
          ))}
        </motion.g>

        <motion.g style={{ x: knotX }}>
          <ellipse className="rope__knot" cx={0} cy={ky} rx={17} ry={9.5} />
          <ellipse className="rope__knothi" cx={-3} cy={ky - 3} rx={8} ry={3.5} />
          <line className="rope__pole" x1={0} y1={ky - 8} x2={0} y2={ky - 42} />
          <path className="rope__flag" d={`M 0 ${ky - 42} L 24 ${ky - 34} L 0 ${ky - 26} Z`} />
          <text className="rope__pull" x={0} y={ky + 30}>
            {label}
          </text>
        </motion.g>
      </svg>
      <PickSide marketId={marketId} question={question} />
    </div>
  );
}
