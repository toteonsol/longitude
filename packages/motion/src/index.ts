export { springs, resolveSpring, easeOutExpo } from "./springs";
export type { SpringName } from "./springs";
export { Reveal } from "./Reveal";
export type { RevealProps } from "./Reveal";
export { Stagger, StaggerItem } from "./Stagger";
export type { StaggerProps, StaggerItemProps } from "./Stagger";
export { NumberTicker, fmt } from "./NumberTicker";
export type { NumberTickerProps } from "./NumberTicker";
export { Flip } from "./Flip";
export type { FlipProps } from "./Flip";
export { Typewriter } from "./Typewriter";
export type { TypewriterProps } from "./Typewriter";
export { Marquee } from "./Marquee";
export type { MarqueeProps } from "./Marquee";
export { Grow } from "./Grow";
export type { GrowProps } from "./Grow";
export { Tilt } from "./Tilt";
export type { TiltProps } from "./Tilt";
export { useClock, useMounted } from "./hooks";

// The engine itself, so apps import from one place.
export {
  motion,
  AnimatePresence,
  LayoutGroup,
  animate,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  useScroll,
  useTime,
} from "motion/react";
export type { Transition, Variants, MotionValue } from "motion/react";
