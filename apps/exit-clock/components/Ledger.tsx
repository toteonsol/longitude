"use client";
import { Stagger, StaggerItem, fmt } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { STATE_LABEL, anchorText, exitState, formatCountdown, formatHold, remainingMs, utcClock } from "@/lib/clock";
import type { ExitToken, Holder } from "@/lib/data";

interface Props {
  token: ExitToken;
  /** Already sorted by expected exit, soonest first. */
  holders: Holder[];
  now: number;
  active: string | null;
  onSelect: (address: string) => void;
  onHover: (address: string | null) => void;
}

/** The side ledger: every hand as a row with a live countdown. Rows are buttons, so keyboards get the hands too. */
export function Ledger({ token, holders, now, active, onSelect, onHover }: Props) {
  const estimated = holders.some((h) => h.holdSource !== "trader");
  return (
    <section className="ledger panel" aria-label="Exit ledger">
      <span className="panel__bolts" aria-hidden="true" />
      <header className="ledger__head">
        <h2 className="ledger__title">
          Ledger <span>soonest exit first</span>
        </h2>
        <time className="ledger__now" dateTime={new Date(now).toISOString()}>
          {utcClock(now)} UTC
        </time>
      </header>
      <Stagger key={token.address} className="ledger__rows" gap={0.035}>
        {holders.map((h, i) => {
          const ms = remainingMs(h.expectedExitAt, now);
          const state = exitState(ms);
          const on = active === h.address;
          return (
            <StaggerItem key={h.address} y={8}>
              <button
                type="button"
                className={`ledger__row is-${state}${on ? " is-active" : ""}`}
                aria-pressed={on}
                title={h.address}
                onClick={() => onSelect(h.address)}
                onPointerEnter={() => onHover(h.address)}
                onPointerLeave={() => onHover(null)}
              >
                <span className="ledger__idx">{String(i + 1).padStart(2, "0")}</span>
                <span className="ledger__time">{formatCountdown(ms)}</span>
                <span className="ledger__who">
                  <b>{h.label}</b>
                  <span className="lg-addr">{shortAddress(h.address, 4)}</span>
                </span>
                <span className="ledger__value">{fmt.usd(h.valueUsd)}</span>
                <span className="ledger__state">{STATE_LABEL[state]}</span>
                <span className="ledger__meta">
                  hold {formatHold(h.avgHoldHours)}
                  {h.holdSource === "trader" ? "" : "*"} · {anchorText(h, now)} · 7d {fmt.pctSigned(h.change7dPct, 0)}
                </span>
              </button>
            </StaggerItem>
          );
        })}
      </Stagger>
      {holders.length === 0 ? <p className="lg-muted">No smart money holders on this token right now.</p> : null}
      {estimated ? <p className="ledger__foot">* token median hold: no completed round trip for this wallet in the 30-day sample.</p> : null}
    </section>
  );
}
