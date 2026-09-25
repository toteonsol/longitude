"use client";
import { type MotionValue, animate, motion, springs, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from "@longitude/motion";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef } from "react";
import type { Tape } from "@/lib/data";
import type { Phase } from "./shared";

interface Props {
  tapes: Tape[];
  index: number;
  phase: Phase;
  /** Fractional tape position, owned by the deck. */
  pos: MotionValue<number>;
  onIndex: (i: number) => void;
}

/** Pixels of wheel travel per tape. */
const STEP = 120;
/** Degrees the reels turn per tape. */
const TURN = 220;
/** How far past the first and last tape the wheel rubber-bands, in tapes. */
const OVERSHOOT = 0.3;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Two reels behind glass and a jog wheel. Drag left to rewind further back; the reels follow the wheel. */
export function TapeWheel({ tapes, index, phase, pos, onIndex }: Props) {
  const last = Math.max(0, tapes.length - 1);
  const reduce = useReducedMotion();
  const disabled = phase === "locked" || phase === "playing" || last === 0;
  const drag = useRef<{ x: number; pos: number; emitted: number } | null>(null);
  /** Extra reel rotation while the tape plays, and the wind-back on STOP. */
  const spin = useMotionValue(0);

  // Snap to the tape whenever the index changes from outside the wheel (keys, ticks, transport).
  useEffect(() => {
    if (drag.current) return;
    const controls = animate(pos, index, reduce ? { duration: 0 } : springs.snappy);
    return () => controls.stop();
  }, [index, pos, reduce]);

  useAnimationFrame((_, delta) => {
    if (phase === "playing" && !reduce) spin.set(spin.get() + delta * 0.22);
  });

  // Back to idle: the reels whir backwards a touch, like a real deck on STOP.
  useEffect(() => {
    if (phase !== "idle" || reduce) return;
    const controls = animate(spin, spin.get() - 240, { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] });
    return () => controls.stop();
  }, [phase, reduce, spin]);

  const rotate = useTransform([pos, spin], ([p = 0, s = 0]: number[]) => -p * TURN + s);
  const ridges = useTransform(pos, (p) => `${Math.round(-p * STEP)}px 0px`);
  const supply = useTransform(pos, (p) => 1 - 0.3 * clamp01(p / Math.max(1, last)));
  const takeup = useTransform(pos, (p) => 0.7 + 0.3 * clamp01(p / Math.max(1, last)));

  const clampPos = (v: number) => Math.max(-OVERSHOOT, Math.min(last + OVERSHOOT, v));
  const nearest = (v: number) => Math.round(Math.max(0, Math.min(last, v)));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, pos: pos.get(), emitted: index };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const v = clampPos(d.pos + (d.x - e.clientX) / STEP);
    pos.set(v);
    const i = nearest(v);
    if (i !== d.emitted) {
      d.emitted = i;
      onIndex(i);
    }
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const i = nearest(pos.get());
    animate(pos, i, reduce ? { duration: 0 } : springs.snappy);
    if (i !== d.emitted) onIndex(i);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const older = e.key === "ArrowLeft" || e.key === "ArrowDown";
    const newer = e.key === "ArrowRight" || e.key === "ArrowUp";
    if (older || newer || e.key === "Home" || e.key === "End") e.preventDefault();
    if (older) onIndex(Math.min(last, index + 1));
    else if (newer) onIndex(Math.max(0, index - 1));
    else if (e.key === "Home") onIndex(0);
    else if (e.key === "End") onIndex(last);
  };

  const current = tapes[index];
  return (
    <div className="wheelbox">
      <svg className="reels" viewBox="0 0 320 124" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="reel-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.09" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="318" height="122" rx="10" className="reels__window" />
        <path d="M 84 24 C 118 16, 202 16, 236 24" className="reels__tape" />
        <path d="M 84 100 L 116 113 L 204 113 L 236 100" className="reels__tape" />
        <circle cx="116" cy="113" r="5" className="reels__guide" />
        <circle cx="204" cy="113" r="5" className="reels__guide" />
        <Reel cx={80} cy={62} rotate={rotate} pack={supply} />
        <Reel cx={240} cy={62} rotate={rotate} pack={takeup} />
        <rect x="1" y="1" width="318" height="62" rx="10" fill="url(#reel-glass)" />
      </svg>
      <div
        className={`wheel${disabled ? " is-disabled" : ""}`}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Tape wheel. Drag, or use the arrow keys, to scrub between dates."
        aria-valuemin={tapes[0]?.daysAgo ?? 0}
        aria-valuemax={tapes[last]?.daysAgo ?? 0}
        aria-valuenow={current?.daysAgo ?? 0}
        aria-valuetext={current ? `${current.daysAgo} days ago, ${current.label}` : undefined}
        aria-disabled={disabled}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <motion.div className="wheel__ridges" style={{ backgroundPosition: ridges }} />
        <div className="wheel__shade" />
        <div className="wheel__notch" />
        <span className="wheel__hint">◀ drag to rewind · forward ▶</span>
      </div>
      <ol className="wheel__ticks">
        {tapes.map((t, i) => (
          <li key={t.date}>
            <button
              type="button"
              className={i === index ? "is-on" : undefined}
              disabled={disabled}
              aria-label={`${t.daysAgo} days ago, ${t.label}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => onIndex(i)}
            >
              T-{t.daysAgo}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Reel({ cx, cy, rotate, pack }: { cx: number; cy: number; rotate: MotionValue<number>; pack: MotionValue<number> }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <motion.g style={{ rotate, transformBox: "fill-box", transformOrigin: "center" }}>
        <motion.g style={{ scale: pack, transformBox: "fill-box", transformOrigin: "center" }}>
          <circle r={42} className="reels__pack" />
          {[30, 150, 270].map((a) => (
            <circle key={a} cx={34 * Math.cos(rad(a))} cy={34 * Math.sin(rad(a))} r={3} className="reels__notch" />
          ))}
        </motion.g>
        <circle r={17} className="reels__hub" />
        {[0, 120, 240].map((a) => (
          <line key={a} x1={0} y1={0} x2={14 * Math.cos(rad(a))} y2={14 * Math.sin(rad(a))} className="reels__spoke" />
        ))}
        <circle r={5} className="reels__hole" />
      </motion.g>
    </g>
  );
}
