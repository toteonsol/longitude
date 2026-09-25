"use client";
import { NumberTicker, Tilt, fmt, motion, springs } from "@longitude/motion";
import type { CSSProperties, ReactNode } from "react";
import type { Pick } from "@/lib/data";
import type { Phase } from "./shared";

interface Props {
  pick: Pick;
  color: string;
  phase: Phase;
  selected: boolean;
  isWinner: boolean;
  /** null until this cassette has been graded. */
  hit: boolean | null;
  onSelect: () => void;
}

/** One pick as a cassette: shell, hubs, a paper label with what smart money did that week. */
export function Cassette({ pick, color, phase, selected, isWinner, hit, onSelect }: Props) {
  const rolling = phase === "playing" || phase === "revealed";
  const revealed = phase === "revealed";
  const locked = selected && phase !== "idle";
  const cls = ["cassette", selected ? "is-selected" : "", revealed && isWinner ? "is-winner" : "", revealed && !isWinner ? "is-loser" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <Tilt max={6} className="cassette__tilt">
      <button
        type="button"
        className={cls}
        style={{ "--tape-color": color } as CSSProperties}
        aria-pressed={selected}
        disabled={phase !== "idle"}
        onClick={onSelect}
        title={`${pick.symbol} on ${pick.chain} · ${pick.address}`}
      >
        <span className="cassette__window" aria-hidden="true">
          <span className="cassette__hub" />
          <span className="cassette__tape" />
          <span className="cassette__hub" />
        </span>
        <span className="cassette__label">
          <span className="cassette__sym">
            <span>${pick.symbol}</span>
            {rolling ? (
              <NumberTicker className="cassette__ret" value={pick.returnPct30d} format={(n) => fmt.pctSigned(n, 1)} duration={2.2} />
            ) : (
              <span className="cassette__chain">{pick.chain}</span>
            )}
          </span>
          <span className="cassette__stat">
            <span>SM bought</span>
            <b>{fmt.usd(pick.buyVolumeUsd)}</b>
          </span>
          <span className="cassette__stat">
            <span>Net flow</span>
            <b>{fmt.usdSigned(pick.netflowUsd)}</b>
          </span>
          <span className="cassette__stat">
            <span>That week</span>
            <b>{fmt.pctSigned(pick.weekChangePct, 1)}</b>
          </span>
        </span>
        <span className="cassette__foot">
          <span>{rolling ? pick.chain : "Side A · 30 days"}</span>
          <span>{fmt.usd(pick.marketCapUsd)} mcap</span>
        </span>
        {locked && !revealed ? <Stamp kind="lock">Locked</Stamp> : null}
        {revealed && isWinner ? <Stamp kind="win">Winner</Stamp> : null}
        {revealed && hit !== null ? (
          <Stamp kind={hit ? "hit" : "miss"} second={isWinner}>
            {hit ? "Hit" : "Miss"}
          </Stamp>
        ) : null}
      </button>
    </Tilt>
  );
}

function Stamp({ kind, second, children }: { kind: "lock" | "win" | "hit" | "miss"; second?: boolean; children: ReactNode }) {
  return (
    <motion.span
      className={`stamp stamp--${kind}${second ? " stamp--second" : ""}`}
      aria-hidden="true"
      initial={{ opacity: 0, scale: 2.6, rotate: -22, x: "-50%", y: "-50%" }}
      animate={{ opacity: 1, scale: 1, rotate: -10, x: "-50%", y: "-50%" }}
      transition={springs.snappy}
    >
      {children}
    </motion.span>
  );
}
