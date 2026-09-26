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

/**
 * A two-sided card. Both faces share one grid cell, so the card is as tall as its taller face, and each face
 * stretches to that height. Give the wrapper a width, plus an aspect ratio or height as its minimum shape.
 */
export function Flip({ flipped, front, back, axis = "y", spring = "snappy", className, style, onClick }: FlipProps) {
  const rotate = axis === "y" ? { rotateY: flipped ? 180 : 0 } : { rotateX: flipped ? 180 : 0 };
  const backFace = axis === "y" ? "rotateY(180deg)" : "rotateX(180deg)";
  return (
    <div className={className} style={{ display: "grid", perspective: 1400, ...style }} onClick={onClick}>
      <motion.div
        style={{ position: "relative", display: "grid", width: "100%", transformStyle: "preserve-3d" }}
        animate={rotate}
        transition={resolveSpring(spring)}
      >
        <div style={{ gridArea: "1 / 1", minWidth: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>{front}</div>
        <div
          style={{
            gridArea: "1 / 1",
            minWidth: 0,
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
