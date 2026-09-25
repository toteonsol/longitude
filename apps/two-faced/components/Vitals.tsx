"use client";
import { type MotionValue, NumberTicker, fmt, motion, useTransform } from "@longitude/motion";
import type { Wallet } from "@/lib/data";

const pctf = (n: number) => `${n.toFixed(0)}%`;

function Cell({ label, value, format, empty }: { label: string; value: number; format: (n: number) => string; empty: boolean }) {
  return (
    <span className="vitals__cell">
      <b>{empty ? "···" : <NumberTicker value={value} format={format} duration={0.9} />}</b>
      <small>{label}</small>
    </span>
  );
}

/** Two stacked rows of the same three numbers; the dial fades one out as the other comes up. */
export function Vitals({ wallet, t }: { wallet: Wallet; t: MotionValue<number> }) {
  const spotO = useTransform(t, [0, 1], [1, 0]);
  const perpO = useTransform(t, [0, 1], [0, 1]);
  const spotY = useTransform(t, [0, 1], [0, -10]);
  const perpY = useTransform(t, [0, 1], [10, 0]);
  const s = wallet.spot;
  const p = wallet.perp;
  return (
    <div className="vitals" aria-hidden="true">
      <motion.div className="vitals__row vitals__row--spot" style={{ opacity: spotO, y: spotY }}>
        <Cell label="win rate" value={s.winRate} format={pctf} empty={s.trades === 0} />
        <Cell label="realized" value={s.pnlUsd} format={fmt.usdSigned} empty={s.trades === 0} />
        <Cell label="exits" value={s.trades} format={fmt.int} empty={s.trades === 0} />
      </motion.div>
      <motion.div className="vitals__row vitals__row--perp" style={{ opacity: perpO, y: perpY }}>
        <Cell label="win rate" value={p.winRate} format={pctf} empty={p.trades === 0} />
        <Cell label="realized" value={p.pnlUsd} format={fmt.usdSigned} empty={p.trades === 0} />
        <Cell label="trades" value={p.trades} format={fmt.int} empty={p.trades === 0} />
      </motion.div>
    </div>
  );
}
