"use client";
import { type MotionValue, motion, useMotionValueEvent, useTransform } from "@longitude/motion";
import { useRef } from "react";
import type { Wallet } from "@/lib/data";
import { Mask } from "./Mask";

interface Props {
  wallet: Wallet;
  /** Where the user put the knob (0..1). */
  target: MotionValue<number>;
  /** The spring that follows it; drives the mask and the crossfades. */
  t: MotionValue<number>;
  onInteract: () => void;
}

/**
 * A native range input for keyboard, touch and click-to-jump, with the visible rail and knob drawn
 * underneath it. The knob rides the spring, not the raw value, so it carries a little momentum.
 */
export function MorphDial({ wallet, target, t, onInteract }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const left = useTransform(t, (v) => `calc(22px + ${v} * (100% - 44px))`);

  useMotionValueEvent(target, "change", (v) => {
    if (input.current) input.current.value = String(Math.round(v * 100));
  });

  const jump = (v: number) => {
    onInteract();
    target.set(v);
  };

  return (
    <div className="dial">
      <button type="button" className="dial__end dial__end--spot" onClick={() => jump(0)}>
        Spot
      </button>
      <div className="dial__track">
        <span className="dial__rail" aria-hidden="true" />
        <input
          ref={input}
          type="range"
          className="dial__input"
          min={0}
          max={100}
          step={1}
          defaultValue={0}
          aria-label="Morph between the spot mask and the perp mask"
          onPointerDown={onInteract}
          onChange={(e) => jump(Number(e.currentTarget.value) / 100)}
        />
        <motion.span className="dial__knob" style={{ left }} aria-hidden="true">
          <Mask seed={wallet.address} spot={wallet.faces.spot} perp={wallet.faces.perp} t={t} className="dial__glyph" />
        </motion.span>
      </div>
      <button type="button" className="dial__end dial__end--perp" onClick={() => jump(1)}>
        Perp
      </button>
    </div>
  );
}
