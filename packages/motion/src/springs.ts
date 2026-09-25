import type { Transition } from "motion/react";

/** One engine, ten feels: every app picks a spring and skins it. */
export const springs = {
  snappy: { type: "spring", stiffness: 520, damping: 32, mass: 0.8 },
  gentle: { type: "spring", stiffness: 140, damping: 22, mass: 1 },
  bouncy: { type: "spring", stiffness: 320, damping: 13, mass: 0.9 },
  slow: { type: "spring", stiffness: 60, damping: 18, mass: 1.2 },
  molasses: { type: "spring", stiffness: 28, damping: 16, mass: 1.6 },
  mechanical: { type: "tween", duration: 0.35, ease: [0.7, 0, 0.3, 1] },
  tape: { type: "tween", duration: 0.6, ease: "linear" },
} as const satisfies Record<string, Transition>;

export type SpringName = keyof typeof springs;

export function resolveSpring(spring: SpringName | Transition | undefined, fallback: SpringName = "gentle"): Transition {
  if (!spring) return springs[fallback];
  return typeof spring === "string" ? springs[spring] : spring;
}

/** The ease used for number tickers and reveals when a tween fits better than a spring. */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
