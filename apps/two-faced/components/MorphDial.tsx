"use client";
import { caption } from "@longitude/kit";
import { type MotionValue, motion, useMotionValueEvent, useTransform } from "@longitude/motion";
import { useCallback, useEffect, useRef } from "react";
import type { Wallet } from "@/lib/data";
import { Mask } from "./Mask";

type Face = "spot" | "perp";
const faceAt = (v: number): Face => (v >= 0.5 ? "perp" : "spot");

/** Recording caption (?rec=1) for the mask the dial just turned to. Both faces are Nansen profiler numbers over 90 days. */
function faceCaption(w: Wallet, face: Face): string {
  if (face === "spot") {
    return w.spot.trades === 0
      ? "Spot mask: Nansen shows no spot record for this wallet on ethereum or base in the last 90 days."
      : `Spot mask: this wallet's 90-day spot record on ${w.spot.chain}, drawn from Nansen's profiler data.`;
  }
  return w.perp.trades === 0
    ? "Perp mask: Nansen shows no Hyperliquid record for this wallet in the last 90 days."
    : "Perp mask: the same wallet's 90-day Hyperliquid perp record, drawn from Nansen's profiler data.";
}

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
  // For the recording caption: the mask the knob showed when the current gesture began, and the wallet on stage.
  const from = useRef<Face>("spot");
  const onStage = useRef(wallet);
  useEffect(() => {
    onStage.current = wallet;
  }, [wallet]);

  useMotionValueEvent(target, "change", (v) => {
    if (input.current) input.current.value = String(Math.round(v * 100));
  });

  /** Once per gesture, and only when the gesture ends on the other mask. Never while a drag is still moving. */
  const settle = useCallback((face: Face) => {
    if (face === from.current) return;
    from.current = face;
    caption(faceCaption(onStage.current, face));
  }, []);

  // The native change event fires once when a drag is let go (or once per key press); React's onChange fires on every step.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onCommit = () => settle(faceAt(Number(el.value) / 100));
    el.addEventListener("change", onCommit);
    return () => el.removeEventListener("change", onCommit);
  }, [settle]);

  const jump = (v: number) => {
    onInteract();
    target.set(v);
  };

  /** The Spot and Perp ends: one press is one gesture. */
  const press = (v: number) => {
    from.current = faceAt(target.get());
    jump(v);
    settle(faceAt(v));
  };

  return (
    <div className="dial">
      <button type="button" className="dial__end dial__end--spot" onClick={() => press(0)}>
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
          onPointerDown={() => {
            onInteract();
            from.current = faceAt(target.get());
          }}
          onChange={(e) => jump(Number(e.currentTarget.value) / 100)}
        />
        <motion.span className="dial__knob" style={{ left }} aria-hidden="true">
          <Mask seed={wallet.address} spot={wallet.faces.spot} perp={wallet.faces.perp} t={t} className="dial__glyph" />
        </motion.span>
      </div>
      <button type="button" className="dial__end dial__end--perp" onClick={() => press(1)}>
        Perp
      </button>
    </div>
  );
}
