"use client";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { easeOutExpo } from "./springs";

export interface NumberTickerProps {
  value: number;
  /** Where the first animation starts. Defaults to 0. */
  from?: number;
  format?: (n: number) => string;
  duration?: number;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

const defaultFormat = (n: number): string => Math.round(n).toLocaleString("en-US");

/** Rolls a number from `from` to `value`; re-rolls whenever `value` changes. Server-render safe. */
export function NumberTicker({ value, from = 0, format = defaultFormat, duration = 1.2, delay = 0, className, style }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(from);
  const reduce = useReducedMotion();

  useMotionValueEvent(mv, "change", (v) => {
    if (ref.current) ref.current.textContent = format(v);
  });

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, delay, ease: easeOutExpo });
    return () => controls.stop();
  }, [value, duration, delay, reduce, mv]);

  return (
    <span ref={ref} className={className} style={style}>
      {format(from)}
    </span>
  );
}

/** Common formatters. */
export const fmt = {
  usd: (n: number): string =>
    Math.abs(n) >= 1e9
      ? `$${(n / 1e9).toFixed(2)}B`
      : Math.abs(n) >= 1e6
        ? `$${(n / 1e6).toFixed(2)}M`
        : Math.abs(n) >= 1e3
          ? `$${(n / 1e3).toFixed(1)}K`
          : `$${n.toFixed(2)}`,
  usdSigned: (n: number): string => `${n < 0 ? "-" : "+"}${fmt.usd(Math.abs(n))}`,
  pct: (n: number, digits = 1): string => `${n.toFixed(digits)}%`,
  pctSigned: (n: number, digits = 1): string => `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`,
  int: (n: number): string => Math.round(n).toLocaleString("en-US"),
  compact: (n: number): string =>
    Math.abs(n) >= 1e9
      ? `${(n / 1e9).toFixed(1)}B`
      : Math.abs(n) >= 1e6
        ? `${(n / 1e6).toFixed(1)}M`
        : Math.abs(n) >= 1e3
          ? `${(n / 1e3).toFixed(1)}K`
          : `${Math.round(n)}`,
};
