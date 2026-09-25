"use client";
import { type HTMLMotionProps, type Transition, type Variants, motion, useReducedMotion } from "motion/react";
import { type SpringName, resolveSpring } from "./springs";

export interface StaggerProps extends HTMLMotionProps<"div"> {
  /** Seconds between children. */
  gap?: number;
  delay?: number;
  inView?: boolean;
  once?: boolean;
}

const container = (gap: number, delay: number): Variants => ({
  hidden: {},
  shown: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Wrap a list; each child `StaggerItem` enters one after another. */
export function Stagger({ gap = 0.06, delay = 0, inView = false, once = true, children, ...rest }: StaggerProps) {
  const v = container(gap, delay);
  if (inView) {
    return (
      <motion.div variants={v} initial="hidden" whileInView="shown" viewport={{ once, amount: 0.2 }} {...rest}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div variants={v} initial="hidden" animate="shown" {...rest}>
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps extends HTMLMotionProps<"div"> {
  y?: number;
  x?: number;
  scale?: number;
  spring?: SpringName | Transition;
}

export function StaggerItem({ y = 12, x = 0, scale = 1, spring = "gentle", children, ...rest }: StaggerItemProps) {
  const reduce = useReducedMotion();
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y, x, scale },
    shown: { opacity: 1, y: 0, x: 0, scale: 1, transition: resolveSpring(spring) },
  };
  return (
    <motion.div variants={item} {...rest}>
      {children}
    </motion.div>
  );
}
