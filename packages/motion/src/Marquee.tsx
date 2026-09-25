"use client";
import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

export interface MarqueeProps {
  children: ReactNode;
  /** Seconds for one full loop. */
  duration?: number;
  reverse?: boolean;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}

/** Ticker tape. Children are duplicated so the loop is seamless. */
export function Marquee({ children, duration = 30, reverse = false, gap = 48, className, style }: MarqueeProps) {
  const reduce = useReducedMotion();
  const track: CSSProperties = { display: "flex", gap, paddingRight: gap, width: "max-content" };
  return (
    <div className={className} style={{ overflow: "hidden", whiteSpace: "nowrap", ...style }}>
      <motion.div
        style={{ display: "flex", width: "max-content" }}
        animate={reduce ? undefined : { x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
      >
        <div style={track}>{children}</div>
        <div style={track} aria-hidden="true">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
