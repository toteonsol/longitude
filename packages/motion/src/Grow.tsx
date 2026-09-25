"use client";
import { type HTMLMotionProps, type Transition, motion } from "motion/react";
import { type SpringName, resolveSpring } from "./springs";

export interface GrowProps extends HTMLMotionProps<"div"> {
  /** 0..100 */
  percent: number;
  axis?: "x" | "y";
  spring?: SpringName | Transition;
  delay?: number;
}

/** A bar that springs to `percent` of its parent. Flows, tug-of-war ropes, fuel gauges. */
export function Grow({ percent, axis = "x", spring = "gentle", delay = 0, style, children, ...rest }: GrowProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const target = axis === "x" ? { width: `${clamped}%` } : { height: `${clamped}%` };
  const initial = axis === "x" ? { width: "0%" } : { height: "0%" };
  return (
    <motion.div initial={initial} animate={target} transition={{ ...resolveSpring(spring), delay }} style={style} {...rest}>
      {children}
    </motion.div>
  );
}
