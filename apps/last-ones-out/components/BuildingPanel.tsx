"use client";
import { NansenLink } from "@longitude/kit";
import { AnimatePresence, Grow, fmt, motion } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import type { Building } from "@/lib/data";
import type { BuildingPlan } from "@/lib/windows";
import { HoldingPoll } from "./HoldingPoll";

interface Props {
  building: Building | null;
  plan: BuildingPlan | null;
  pinned: boolean;
  onClose: () => void;
  /** Pointer is over the panel: keep the previewed building up. */
  onHold?: () => void;
  /** Pointer left the panel: let the preview clear. */
  onRelease?: () => void;
}

const pop = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { type: "spring", stiffness: 420, damping: 32 } as const,
};

/** The numbers behind a building. Hover previews, tap pins. */
export function BuildingPanel({ building: b, plan, pinned, onClose, onHold, onRelease }: Props) {
  return (
    <aside className={`panel${b ? " is-open" : ""}`} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {b && plan ? (
          <motion.div key={`${b.chain}:${b.address}`} className="panel__card" onPointerEnter={onHold} onPointerLeave={onRelease} {...pop}>
            <header className="panel__head">
              <div>
                <span className="panel__rank">Exit #{b.rank} this week</span>
                <h3 className="panel__symbol">${b.symbol}</h3>
                <span className="panel__name">
                  {b.name} · <em>{b.chain}</em>
                </span>
                <NansenLink kind="token" address={b.address} chain={b.chain} className="panel__nansen" />
              </div>
              {pinned ? (
                <button type="button" className="panel__close" onClick={onClose} aria-label="Unpin this building">
                  ×
                </button>
              ) : (
                <span className="panel__pin">tap to pin</span>
              )}
            </header>

            <dl className="panel__stats">
              <div className="panel__stat panel__stat--smart">
                <dt>Smart money · 7d</dt>
                <dd>{fmt.usdSigned(b.smartNetFlow7dUsd)}</dd>
                <small>{fmt.int(b.smartWalletCount)} wallets</small>
              </div>
              <div className="panel__stat panel__stat--retail">
                <dt>Retail · 7d</dt>
                <dd>{fmt.usdSigned(b.retailNetFlow7dUsd)}</dd>
                <small>{fmt.int(b.retailWalletCount)} wallets</small>
              </div>
              <div className="panel__stat">
                <dt>Price · 24h</dt>
                <dd className={b.priceChange24hPct < 0 ? "is-down" : "is-up"}>{fmt.pctSigned(b.priceChange24hPct)}</dd>
              </div>
              <div className="panel__stat">
                <dt>Market cap</dt>
                <dd>{fmt.usd(b.marketCapUsd)}</dd>
              </div>
            </dl>

            <div className="panel__windows">
              <div className="panel__windowshead">
                <span>{plan.count} windows</span>
                <b>{plan.stillOn} still on</b>
              </div>
              <div className="panel__track">
                <Grow percent={(plan.litCount / plan.count) * 100} className="panel__fill panel__fill--dusk" spring="snappy" />
                <Grow percent={(plan.stillOn / plan.count) * 100} className="panel__fill panel__fill--now" spring="snappy" delay={0.12} />
              </div>
              <div className="panel__legend">
                <span>
                  <i className="panel__dot panel__dot--dusk" />
                  {Math.round(b.lit * 100)}% lit at dusk
                </span>
                <span>
                  <i className="panel__dot panel__dot--dark" />
                  {Math.round(b.darkness * 100)}% of those went dark
                </span>
              </div>
            </div>

            <p className="panel__caption">{b.caption}</p>

            <div className="panel__poll">
              <HoldingPoll building={b} />
            </div>

            <span className="panel__addr lg-addr" title={b.address}>
              {shortAddress(b.address, 6)}
            </span>
          </motion.div>
        ) : (
          <motion.div key="empty" className="panel__card panel__card--empty" onPointerEnter={onHold} onPointerLeave={onRelease} {...pop}>
            <p>
              <b>Hover or tap a building.</b>
            </p>
            <p className="lg-muted">Tallest is the biggest smart money exit this week. Lit windows are retail still holding. Watch them go out.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
