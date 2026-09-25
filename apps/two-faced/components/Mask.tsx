"use client";
import { type MotionValue, animate, motion, useMotionValue, useReducedMotion, useTransform } from "@longitude/motion";
import { useEffect, useId, useMemo } from "react";
import type { Expression } from "@/lib/data";
import { CHARCOAL, CRIMSON, HOLE, IVORY, type MaskGeometry, NOSES, browPath, eyePath, lerp, maskGeometry, mouthPath, outlinePath, ribbonPath, tearPath } from "@/lib/mask";

export interface MaskProps {
  seed: string;
  spot: Expression;
  perp: Expression;
  /** 0 = the spot face, 1 = the perp face. Drive it with a spring and the mask breathes. */
  t: MotionValue<number>;
  /** Blink every few seconds. Only the mask on stage should. */
  blink?: boolean;
  className?: string;
  title?: string;
}

interface LivePaths {
  outline: string;
  browL: MotionValue<string>;
  browR: MotionValue<string>;
  eyeL: MotionValue<string>;
  eyeR: MotionValue<string>;
  lip: MotionValue<string>;
  mouth: MotionValue<string>;
  blush: MotionValue<number>;
  tear: MotionValue<number>;
}

function Ornaments({ g }: { g: MaskGeometry }) {
  return (
    <>
      {g.ornament === 0 ? <path d="M100 34 l7 9 l-7 9 l-7 -9 Z" fill={CRIMSON} /> : null}
      {g.ornament === 1 ? (
        <g fill={CRIMSON}>
          <circle cx={88} cy={43} r={2.6} />
          <circle cx={100} cy={40} r={2.6} />
          <circle cx={112} cy={43} r={2.6} />
        </g>
      ) : null}
      {g.ornament === 2 ? <path d="M 87 47 q 13 -12 26 0" fill="none" stroke={CRIMSON} strokeWidth={2.6} strokeLinecap="round" /> : null}
      {g.cheekMark === 1 ? (
        <g stroke={CRIMSON} strokeWidth={2} strokeLinecap="round">
          <path d="M 46 126 l 6 -4 M 50 133 l 6 -4 M 54 140 l 6 -4" />
          <path d="M 154 126 l -6 -4 M 150 133 l -6 -4 M 146 140 l -6 -4" />
        </g>
      ) : null}
      {g.cheekMark === 2 ? (
        <g fill={CRIMSON}>
          <circle cx={50} cy={132} r={3} />
          <circle cx={150} cy={132} r={3} />
        </g>
      ) : null}
    </>
  );
}

/** One colouring of the face. Drawn twice: the ivory day layer, and the charcoal night layer that wipes across it. */
function Layer({ g, face, feature, p, id, still }: { g: MaskGeometry; face: string; feature: string; p: LivePaths; id: string; still: boolean }) {
  return (
    <g>
      <path d={p.outline} fill={face} stroke={feature} strokeOpacity={0.35} strokeWidth={1.5} />
      <path d={p.outline} fill={`url(#${id}hl)`} opacity={0.45} />

      {/* heat: a crimson flush that rises with leverage, losses and churn */}
      <motion.g opacity={p.blush}>
        <g filter={`url(#${id}blur)`}>
          <ellipse cx={58} cy={140} rx={15} ry={9} fill={CRIMSON} />
          <ellipse cx={142} cy={140} rx={15} ry={9} fill={CRIMSON} />
        </g>
      </motion.g>

      <Ornaments g={g} />

      <motion.path d={p.browL} fill="none" stroke={feature} strokeWidth={g.browWeight} strokeLinecap="round" />
      <motion.path d={p.browR} fill="none" stroke={feature} strokeWidth={g.browWeight} strokeLinecap="round" />

      <motion.path d={p.eyeL} fill={HOLE} stroke={feature} strokeWidth={1.5} />
      <motion.path d={p.eyeR} fill={HOLE} stroke={feature} strokeWidth={1.5} />

      <path d={NOSES[g.nose]} fill="none" stroke={feature} strokeWidth={2.2} strokeLinecap="round" strokeOpacity={0.8} />

      {/* crimson lips around the opening */}
      <motion.path d={p.lip} fill={CRIMSON} />
      <motion.path d={p.mouth} fill={HOLE} />

      <motion.g opacity={p.tear} animate={still ? { y: 0 } : { y: [0, 4, 0] }} transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2.6, ease: "easeInOut" }}>
        <path d={tearPath(g)} fill={feature} />
      </motion.g>
    </g>
  );
}

/**
 * A theatre mask generated from the address. Every feature path is a MotionValue derived from `t`, so a
 * drag on the dial redraws them on the animation frame with no React re-render. The expression morphs
 * continuously; the colours do not blend (that would go grey) but wipe: the charcoal night face slides
 * in from the perp side, so at the midpoint the mask is half comedy and half tragedy.
 */
export function Mask({ seed, spot, perp, t, blink = false, className, title }: MaskProps) {
  const id = `mask${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const g = useMemo(() => maskGeometry(seed), [seed]);
  const reduce = useReducedMotion();
  const lid = useMotionValue(1);

  useEffect(() => {
    if (!blink || reduce) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(
        () => {
          if (stopped) return;
          animate(lid, [1, 0.06, 1], { duration: 0.28, times: [0, 0.45, 1], ease: "easeInOut" });
          schedule();
        },
        2400 + g.blinkJitter * 2600 + Math.random() * 1600,
      );
    };
    schedule();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [blink, reduce, lid, g.blinkJitter]);

  const mouth = useTransform(t, (v) => lerp(spot.mouth, perp.mouth, v));
  const brow = useTransform(t, (v) => lerp(spot.brow, perp.brow, v));
  const eyes = useTransform(t, (v) => lerp(spot.eyes, perp.eyes, v));
  const heat = useTransform(t, (v) => lerp(spot.heat, perp.heat, v));
  const tear = useTransform(t, (v) => lerp(spot.tear ? 1 : 0, perp.tear ? 1 : 0, v));
  const blush = useTransform(heat, (h) => h * 0.6);
  const mouthD = useTransform(mouth, (m) => mouthPath(g, m, 0));
  const lipD = useTransform(mouth, (m) => mouthPath(g, m, 5));
  const browL = useTransform(brow, (b) => browPath(g, b, -1));
  const browR = useTransform(brow, (b) => browPath(g, b, 1));
  const eyeL = useTransform([eyes, lid, mouth], ([o = 0, l = 1, m = 0]: number[]) => eyePath(g, o * l, m, -1));
  const eyeR = useTransform([eyes, lid, mouth], ([o = 0, l = 1, m = 0]: number[]) => eyePath(g, o * l, m, 1));
  const nightX = useTransform(t, (v) => 200 * (1 - v));
  const nightW = useTransform(t, (v) => 200 * v);

  const paths: LivePaths = { outline: outlinePath(g), browL, browR, eyeL, eyeR, lip: lipD, mouth: mouthD, blush, tear };
  const still = Boolean(reduce);

  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label={title ?? "Wallet mask"} focusable="false">
      <defs>
        <linearGradient id={`${id}hl`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}blur`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <clipPath id={`${id}night`}>
          <motion.rect x={nightX} y={0} width={nightW} height={240} />
        </clipPath>
      </defs>

      {/* ribbons that tie the mask on */}
      <path d={ribbonPath(g)} fill={CRIMSON} />

      {/* day */}
      <Layer g={g} face={IVORY} feature={CHARCOAL} p={paths} id={id} still={still} />
      {/* night, wiping in from the perp side */}
      <g clipPath={`url(#${id}night)`}>
        <Layer g={g} face={CHARCOAL} feature={IVORY} p={paths} id={id} still={still} />
      </g>
    </svg>
  );
}
