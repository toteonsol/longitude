"use client";
import { Typewriter } from "@longitude/motion";

type Tag = "h1" | "h2" | "h3" | "p" | "span" | "div";

interface Props {
  text: string;
  /** Until true the line holds its measure, invisible; then it sets itself in. */
  active: boolean;
  /** Milliseconds per character. */
  speed?: number;
  delay?: number;
  onDone?: () => void;
  as?: Tag;
  className?: string;
}

/**
 * A line of type that reserves its space on the first paint, so the columns never reflow while the
 * compositor works, then types itself in over its own ghost.
 */
export function Typeset({ text, active, speed = 24, delay = 0, onDone, as: Tag = "span", className }: Props) {
  return (
    <Tag className={["typeset", active ? "is-live" : "", className ?? ""].filter(Boolean).join(" ")}>
      <span className="typeset__ghost" aria-hidden="true">
        {text}
      </span>
      {active ? <Typewriter text={text} speed={speed} delay={delay} cursor onDone={onDone} className="typeset__live" /> : null}
    </Tag>
  );
}
