"use client";
import { social, useIdentity, useReactions } from "@longitude/kit";
import { NumberTicker } from "@longitude/motion";
import { useCallback, useState } from "react";

const KINDS = ["crowd", "smart"] as const;
type Side = (typeof KINDS)[number];

const SIDE_TEXT: Record<Side, string> = { crowd: "the crowd", smart: "smart money" };

const calledKey = (marketId: string): string => `odds-vs-flow:called:${marketId}`;

function alreadyCalled(marketId: string): boolean {
  try {
    return localStorage.getItem(calledKey(marketId)) === "1";
  } catch {
    return false;
  }
}

function markCalled(marketId: string): void {
  try {
    localStorage.setItem(calledKey(marketId), "1");
  } catch {
    /* private mode */
  }
}

interface Props {
  marketId: string;
  question: string;
}

/**
 * "Pick a side": one vote per visitor per bout, kept as reactions on `bout:<marketId>`. The
 * tallies sit under each team, the buttons on the knot's centre line. Every call is fail-safe:
 * with the social API unreachable the counts stay at zero and the rope is untouched.
 */
export function PickSide({ marketId, question }: Props) {
  const target = `bout:${marketId}`;
  const { counts, mine, toggle } = useReactions(target, [...KINDS]);
  const me = useIdentity();
  const [busy, setBusy] = useState(false);
  const side: Side | null = mine.includes("crowd") ? "crowd" : mine.includes("smart") ? "smart" : null;

  const pick = useCallback(
    async (next: Side) => {
      if (busy) return;
      setBusy(true);
      try {
        const firstCall = side === null && !alreadyCalled(marketId);
        // Switching sides drops the old pick first; tapping the side already held un-picks it.
        if (side && side !== next) await toggle(side);
        await toggle(next);
        if (side !== next && firstCall) {
          markCalled(marketId);
          void social.event("call", `${me?.handle ?? "Someone"} sided with ${SIDE_TEXT[next]} on "${question}"`);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, side, toggle, marketId, question, me],
  );

  const crowdCount = counts.crowd ?? 0;
  const smartCount = counts.smart ?? 0;

  return (
    <div className="picks" role="group" aria-label="Pick a side">
      <span className="picks__tally picks__tally--crowd" aria-live="polite">
        <b>
          <NumberTicker value={crowdCount} duration={0.6} />
        </b>
        <small>with the crowd</small>
      </span>
      <span className="lg-reactions picks__buttons">
        <button
          type="button"
          className={`lg-reaction picks__btn picks__btn--crowd${side === "crowd" ? " is-mine" : ""}`}
          aria-pressed={side === "crowd"}
          disabled={busy}
          onClick={() => void pick("crowd")}
        >
          ◀ Crowd
        </button>
        <span className="picks__label">{side ? "your pick" : "pick a side"}</span>
        <button
          type="button"
          className={`lg-reaction picks__btn picks__btn--smart${side === "smart" ? " is-mine" : ""}`}
          aria-pressed={side === "smart"}
          disabled={busy}
          onClick={() => void pick("smart")}
        >
          Smart money ▶
        </button>
      </span>
      <span className="picks__tally picks__tally--smart" aria-live="polite">
        <b>
          <NumberTicker value={smartCount} duration={0.6} />
        </b>
        <small>with smart money</small>
      </span>
    </div>
  );
}
