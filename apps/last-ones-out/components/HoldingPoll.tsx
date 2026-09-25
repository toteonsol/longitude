"use client";
import { ReactionBar, social, useIdentity } from "@longitude/kit";
import { type MouseEvent, useEffect, useId, useState } from "react";
import type { Building } from "@/lib/data";

const KINDS = ["holding", "left"];
const GLYPHS: Record<string, string> = { holding: "still holding", left: "got out" };
const SYNC_EVENT = "lo:poll";

export const pollTarget = (b: Pick<Building, "chain" | "address">): string => `building:${b.chain}:${b.address}`;

interface Props {
  building: Building;
  /** Register rows: no question label, tighter buttons. */
  compact?: boolean;
}

/**
 * "Still in?" for one building: the kit's ReactionBar (one vote per visitor per kind) with its two counts
 * drawn next to a lit and a dark window (CSS on the kit's markup). Tapping "still holding" on, not off,
 * posts a feed line. Fail-safe by construction: every social call swallows failures, so with the API
 * unreachable the buttons keep their optimistic state and nothing else on the page changes.
 */
export function HoldingPoll({ building: b, compact = false }: Props) {
  const me = useIdentity();
  const instance = useId();
  const target = pollTarget(b);
  const [take, setTake] = useState(0);

  // The panel and the register can show the same building at once. After a vote in one, the other refetches.
  useEffect(() => {
    const onSync = (e: Event) => {
      const d = (e as CustomEvent<{ target: string; source: string }>).detail;
      if (d.target === target && d.source !== instance) setTake((t) => t + 1);
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [target, instance]);

  // Capture runs before the bar's own click handler, so aria-pressed still holds the pre-tap state.
  const onClickCapture = (e: MouseEvent<HTMLSpanElement>) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button.lg-reaction");
    if (!btn) return;
    if (btn.title === "holding" && btn.getAttribute("aria-pressed") !== "true") {
      void social.event("custom", `${me?.handle ?? "Someone"} admits still holding $${b.symbol}`);
    }
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { target, source: instance } })), 900);
  };

  return (
    <span className={`poll${compact ? " poll--compact" : ""}`} onClickCapture={onClickCapture}>
      {compact ? null : <span className="poll__q">Still in?</span>}
      <ReactionBar key={take} target={target} kinds={KINDS} glyphs={GLYPHS} />
    </span>
  );
}
