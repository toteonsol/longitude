"use client";
import { type Transition, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { type SpringName, resolveSpring } from "./springs";

export interface FlipProps {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  axis?: "x" | "y";
  spring?: SpringName | Transition;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/** A two-sided card. Give the wrapper a size; both faces fill it. */
export function Flip({ flipped, front, back, axis = "y", spring = "snappy", className, style, onClick }: FlipProps) {
  const rotate = axis === "y" ? { rotateY: flipped ? 180 : 0 } : { rotateX: flipped ? 180 : 0 };
  const backFace = axis === "y" ? "rotateY(180deg)" : "rotateX(180deg)";
  return (
    <div className={className} style={{ perspective: 1400, ...style }} onClick={onClick}>
      <motion.div
        style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d" }}
        animate={rotate}
        transition={resolveSpring(spring)}
      >
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>{front}</div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: backFace,
          }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}
