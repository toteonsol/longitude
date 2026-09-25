"use client";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import type { CSSProperties, PointerEvent, ReactNode } from "react";

export interface TiltProps {
  children: ReactNode;
  /** Max degrees of tilt. */
  max?: number;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/** Pointer-following 3D tilt. Trading cards, tapes, coats of arms. */
export function Tilt({ children, max = 10, className, style, onClick }: TiltProps) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 220, damping: 20 });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 220, damping: 20 });

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const leave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", transformPerspective: 1000, ...style }}
      onPointerMove={move}
      onPointerLeave={leave}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
