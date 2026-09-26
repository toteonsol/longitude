"use client";
import { NansenLink } from "@longitude/kit";
import { AnimatePresence, Stagger, StaggerItem, fmt, motion } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { STATE_LABEL, anchorText, exitState, formatCountdown, formatHold, remainingMs, utcClock } from "@/lib/clock";
import type { ExitToken, Holder } from "@/lib/data";
import { Pin } from "./Pin";
import type { WatchData, WatchItem } from "./useWatchlist";

interface Props {
  token: ExitToken;
  /** Already sorted by expected exit, soonest first. */
  holders: Holder[];
  now: number;
  active: string | null;
  /** Addresses on this token the visitor is watching. */
  watched: Set<string>;
  /** The whole watchlist, every token. */
  watching: WatchItem[];
  /** Watch id → expectedExitAt from this snapshot, for hands that are still in it. */
  fresh: Map<string, string>;
  onSelect: (address: string) => void;
  onHover: (address: string | null) => void;
  onWatch: (holder: Holder) => void;
  onUnwatch: (id: string) => void;
  onJump: (w: WatchData) => void;
}

/** The side ledger: every hand as a row with a live countdown and a Watch pin. Rows are buttons, so keyboards get the hands too. */
export function Ledger({ token, holders, now, active, watched, watching, fresh, onSelect, onHover, onWatch, onUnwatch, onJump }: Props) {
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

      {watching.length > 0 ? <Watching items={watching} now={now} fresh={fresh} current={token} onJump={onJump} onUnwatch={onUnwatch} /> : null}

      <Stagger key={token.address} className="ledger__rows" gap={0.035}>
        {holders.map((h, i) => {
          const ms = remainingMs(h.expectedExitAt, now);
          const state = exitState(ms);
          const on = active === h.address;
          const isWatched = watched.has(h.address);
          return (
            <StaggerItem key={h.address} y={8}>
              <div className={`ledger__row is-${state}${on ? " is-active" : ""}${isWatched ? " is-watched" : ""}`}>
                <button
                  type="button"
                  className="ledger__main"
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
                {/* Between the two buttons, never inside one; CSS sets it on the free end of the meta line. */}
                <NansenLink address={h.address} chain={token.chain} className="ledger__nansen" />
                <button
                  type="button"
                  className={`ledger__watch${isWatched ? " is-on" : ""}`}
                  aria-pressed={isWatched}
                  aria-label={isWatched ? `Stop watching ${shortAddress(h.address)}` : `Watch ${shortAddress(h.address)}`}
                  title={isWatched ? "Watching · click to stop" : "Watch this hand"}
                  onClick={() => onWatch(h)}
                >
                  <Pin on={isWatched} />
                </button>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
      {holders.length === 0 ? <p className="lg-muted">No smart money holders on this token right now.</p> : null}
      {estimated ? <p className="ledger__foot">* token median hold: no completed round trip for this wallet in the 30-day sample.</p> : null}
    </section>
  );
}

interface WatchingProps {
  items: WatchItem[];
  now: number;
  fresh: Map<string, string>;
  current: ExitToken;
  onJump: (w: WatchData) => void;
  onUnwatch: (id: string) => void;
}

/** Every watched hand across tokens, soonest exit first, counting down on this snapshot's data when it has the hand. */
function Watching({ items, now, fresh, current, onJump, onUnwatch }: WatchingProps) {
  const rows = items
    .map((i) => ({ ...i, exitAt: fresh.get(i.id) ?? i.data.expectedExitAt, inSnapshot: fresh.has(i.id) }))
    .sort((a, b) => Date.parse(a.exitAt) - Date.parse(b.exitAt));
  return (
    <div className="watching" aria-label="Watching">
      <div className="watching__head">
        <span className="watching__title">
          Watching <b>({rows.length})</b>
        </span>
        <span className="watching__hint">brass pins on the dial · live</span>
      </div>
      <ul className="watching__list">
        <AnimatePresence initial={false}>
          {rows.map((w) => {
            const ms = remainingMs(w.exitAt, now);
            const state = exitState(ms);
            const here = w.data.chain === current.chain && w.data.tokenAddress === current.address;
            const title = !w.inSnapshot ? "Not in this snapshot any more" : here ? "Show on the dial" : `Switch to $${w.data.symbol}`;
            return (
              <motion.li
                key={w.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={`watching__item is-${state}${here ? " is-here" : ""}${w.inSnapshot ? "" : " is-gone"}`}
              >
                <button type="button" className="watching__main" title={title} onClick={() => onJump(w.data)}>
                  <span className="watching__time">{formatCountdown(ms)}</span>
                  <span className="watching__sym">${w.data.symbol}</span>
                  <span className="watching__who">
                    <b>{w.data.label}</b>
                    <span className="lg-addr">{shortAddress(w.data.address, 4)}</span>
                  </span>
                  <span className="watching__value">{fmt.usd(w.data.valueUsd)}</span>
                </button>
                <button type="button" className="watching__unwatch" aria-label={`Stop watching ${shortAddress(w.data.address)}`} title="Stop watching" onClick={() => onUnwatch(w.id)}>
                  ×
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
