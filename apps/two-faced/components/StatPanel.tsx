"use client";
import { type MotionValue, NumberTicker, Stagger, StaggerItem, fmt, motion, useTransform } from "@longitude/motion";
import type { TopSymbol, Wallet } from "@/lib/data";

interface Props {
  side: "spot" | "perp";
  wallet: Wallet;
  t: MotionValue<number>;
}

const pctf = (n: number) => `${n.toFixed(0)}%`;
const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;

function Stat({ label, value, format, empty }: { label: string; value: number; format: (n: number) => string; empty: boolean }) {
  return (
    <div className="panel__stat">
      <dt>{label}</dt>
      <dd>{empty ? "—" : <NumberTicker value={value} format={format} duration={1} />}</dd>
    </div>
  );
}

function Chips({ items, prefix }: { items: TopSymbol[]; prefix: string }) {
  if (!items.length) return null;
  return (
    <div className="panel__chips">
      {items.map((it) => (
        <span key={it.symbol} className={`chip${it.pnlUsd < 0 ? " chip--neg" : ""}`}>
          {prefix}
          {it.symbol} <em>{fmt.usdSigned(it.pnlUsd)}</em>
        </span>
      ))}
    </div>
  );
}

/** One side of the stage. The dial shades it down when the other face has the light. */
export function StatPanel({ side, wallet: w, t }: Props) {
  const isSpot = side === "spot";
  const shade = useTransform(t, (v) => (isSpot ? v * 0.5 : (1 - v) * 0.3));
  const body = useTransform(t, (v) => (isSpot ? 1 - v * 0.35 : 0.65 + v * 0.35));
  const empty = isSpot ? w.spot.trades === 0 : w.perp.trades === 0;

  return (
    <section className={`panel panel--${side}`} aria-label={isSpot ? "Spot face" : "Perp face"}>
      <motion.span className="panel__shade" style={{ opacity: shade }} aria-hidden="true" />
      <motion.div className="panel__body" style={{ opacity: body }}>
        <Stagger key={`${side}:${w.address}`} className="panel__stack" gap={0.055}>
          <StaggerItem y={8}>
            <p className="panel__kicker">{isSpot ? `Act I · Spot · ${w.spot.chain} · 90 days` : "Act II · Perps · Hyperliquid · 90 days"}</p>
          </StaggerItem>
          <StaggerItem y={10}>
            <h3 className="panel__word">{isSpot ? w.temperament.spot : w.temperament.perp}</h3>
            <p className="panel__maskname">{isSpot ? "the comedy mask" : "the tragedy mask"}</p>
          </StaggerItem>
          <StaggerItem y={10}>
            <dl className="panel__stats">
              {isSpot ? (
                <>
                  <Stat label="Win rate" value={w.spot.winRate} format={pctf} empty={empty} />
                  <Stat label="Realized" value={w.spot.pnlUsd} format={fmt.usdSigned} empty={empty} />
                  <Stat label="Exits" value={w.spot.trades} format={fmt.int} empty={empty} />
                  <Stat label="Tokens" value={w.spot.tokens} format={fmt.int} empty={empty} />
                </>
              ) : (
                <>
                  <Stat label="Win rate" value={w.perp.winRate} format={pctf} empty={empty} />
                  <Stat label="Realized" value={w.perp.pnlUsd} format={fmt.usdSigned} empty={empty} />
                  <Stat label="Trades" value={w.perp.trades} format={fmt.int} empty={empty} />
                  <Stat label="Fees paid" value={w.perp.feesUsd} format={fmt.usd} empty={empty} />
                </>
              )}
            </dl>
          </StaggerItem>
          <StaggerItem y={8}>
            <p className="panel__roi">
              {isSpot
                ? empty
                  ? "No exits to score."
                  : `${signedPct(w.spot.roiPct)} realized ROI`
                : empty
                  ? "No closed trades to score."
                  : `${signedPct(w.perp.roiPct)} on closed notional · ${w.perp.coins} coins · ${w.perp.closedTrades} closes`}
            </p>
          </StaggerItem>
          <StaggerItem y={8}>
            <p className="panel__sub">{isSpot ? "Top tokens by realized PnL" : "Top coins by realized PnL"}</p>
            <Chips items={isSpot ? w.spot.topTokens : w.perp.topCoins} prefix={isSpot ? "$" : ""} />
            {(isSpot ? w.spot.topTokens : w.perp.topCoins).length === 0 ? <p className="panel__flat">Nothing on the bill.</p> : null}
          </StaggerItem>
          {!isSpot ? (
            <StaggerItem y={8}>
              <p className="panel__sub">Open positions{w.perp.openPositions.length ? "" : " · flat"}</p>
              {w.perp.openPositions.length ? (
                <ul className="positions">
                  {w.perp.openPositions.map((p) => (
                    <li key={`${p.coin}:${p.side}`} className="pos">
                      <span className="pos__coin">{p.coin}</span>
                      <span className={`pos__side pos__side--${p.side.toLowerCase()}`}>{p.side}</span>
                      <span className="pos__lev">{p.leverage}×</span>
                      <span className="pos__size">{fmt.usd(p.sizeUsd)}</span>
                      <span className={`pos__pnl${p.pnlUsd < 0 ? " is-neg" : ""}`}>{fmt.usdSigned(p.pnlUsd)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel__flat">No open positions on Hyperliquid right now.</p>
              )}
              {w.perp.openPositions.length ? (
                <p className="panel__roi">
                  {fmt.usdSigned(w.perp.unrealizedPnlUsd)} unrealized · up to {w.perp.maxLeverage}× · account {fmt.usd(w.perp.accountValueUsd)}
                </p>
              ) : null}
            </StaggerItem>
          ) : null}
          <StaggerItem y={6}>
            <p className="panel__note">{isSpot ? w.notes.spot : w.notes.perp}</p>
          </StaggerItem>
        </Stagger>
      </motion.div>
    </section>
  );
}
