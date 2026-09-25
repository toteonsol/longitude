"use client";
import { type HTMLMotionProps, type Transition, motion, useReducedMotion } from "motion/react";
import { type SpringName, resolveSpring } from "./springs";

export interface RevealProps extends HTMLMotionProps<"div"> {
  delay?: number;
  /** Start offset in px. */
  y?: number;
  x?: number;
  scale?: number;
  /** Start blur in px. */
  blur?: number;
  /** Animate when scrolled into view instead of on mount. */
  inView?: boolean;
  once?: boolean;
  spring?: SpringName | Transition;
}

/** Fade + drift in. The building block behind most entrances. */
export function Reveal({
  delay = 0,
  y = 14,
  x = 0,
  scale = 1,
  blur = 0,
  inView = false,
  once = true,
  spring = "gentle",
  children,
  ...rest
}: RevealProps) {
  const reduce = useReducedMotion();
  const hidden = reduce
    ? { opacity: 0 }
    : { opacity: 0, y, x, scale, filter: blur ? `blur(${blur}px)` : "blur(0px)" };
  const shown = { opacity: 1, y: 0, x: 0, scale: 1, filter: "blur(0px)" };
  const transition = { ...resolveSpring(spring), delay };
  if (inView) {
    return (
      <motion.div initial={hidden} whileInView={shown} viewport={{ once, amount: 0.25 }} transition={transition} {...rest}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div initial={hidden} animate={shown} transition={transition} {...rest}>
      {children}
    </motion.div>
  );
}
