"use client";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export interface TypewriterProps {
  text: string;
  /** ms per character. */
  speed?: number;
  delay?: number;
  cursor?: boolean;
  /** Called once the full text is on screen. */
  onDone?: () => void;
  className?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
}

/** Types text in one character at a time. Headlines that set themselves. */
export function Typewriter({ text, speed = 28, delay = 0, cursor = false, onDone, className, as: Tag = "span" }: TypewriterProps) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(reduce ? text.length : 0);

  useEffect(() => {
    if (reduce) {
      setCount(text.length);
      onDone?.();
      return;
    }
    setCount(0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setCount(i);
      if (i < text.length) timer = setTimeout(tick, speed);
      else onDone?.();
    };
    timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, delay, reduce]);

  return (
    <Tag className={className} aria-label={text}>
      {text.slice(0, count)}
      {cursor && count < text.length ? <span aria-hidden="true">▍</span> : null}
    </Tag>
  );
}
