"use client";
import { NumberTicker, Reveal, fmt, useClock, useMounted, useReducedMotion } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { useMemo, useState } from "react";
import { anchorText, exitState, formatCountdown, formatHold, remainingMs } from "@/lib/clock";
import type { ExitClockData, ExitToken, Holder } from "@/lib/data";
import { Dial } from "./Dial";
import { Ledger } from "./Ledger";
import { TokenTabs } from "./TokenTabs";

export function ExitClock({ data }: { data: ExitClockData }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const mounted = useMounted();
  const clock = useClock(1000);
  const reduce = Boolean(useReducedMotion());
  // Server and first client render both use the snapshot instant so hydration matches; then the live clock takes over.
  const generated = Date.parse(data.generatedAt);
  const now = mounted ? clock : generated;
  const token: ExitToken | undefined = data.tokens[index] ?? data.tokens[0];
  const holders = useMemo(
    () => (token ? [...token.holders].sort((a, b) => Date.parse(a.expectedExitAt) - Date.parse(b.expectedExitAt)) : []),
    [token],
  );
  if (!token) return <p className="lg-muted">Nothing to time: this snapshot has no tokens.</p>;

  const active = hovered ?? selected;
  const activeHolder = active ? (holders.find((h) => h.address === active) ?? null) : null;
  const overdueNow = holders.filter((h) => remainingMs(h.expectedExitAt, now) <= 0).length;
  const next = holders.find((h) => remainingMs(h.expectedExitAt, now) > 0) ?? null;
  const pick = (i: number) => {
    setIndex(i);
    setSelected(null);
    setHovered(null);
  };
  const toggle = (address: string) => setSelected((cur) => (cur === address ? null : address));

  return (
    <div className="clock">
      <div className="clock__tabs">
        <TokenTabs tokens={data.tokens} index={index} now={now} onChange={pick} />
      </div>

      <Reveal key={token.address} className="clock__stats stats" spring="snappy">
        <div className="stat">
          <span className="stat__k">Smart money held</span>
          <b className="stat__v">
            <NumberTicker value={token.totalValueUsd} format={fmt.usd} />
          </b>
          <span className="stat__sub">
            {token.traderCount} smart traders · {fmt.usdSigned(token.netFlow7dUsd)} net 7d
          </span>
        </div>
        <div className="stat">
          <span className="stat__k">Hands · overdue</span>
          <b className="stat__v">
            {holders.length} <em>· {overdueNow}</em>
          </b>
          <span className="stat__sub">
            {token.tradersPaired} wallets with round trips in {token.tradesSampled} trades
          </span>
        </div>
        <div className="stat">
          <span className="stat__k">Median hold</span>
          <b className="stat__v">{formatHold(token.medianHoldHours)}</b>
          <span className="stat__sub">30-day smart money sample</span>
        </div>
        <div className="stat stat--next">
          <span className="stat__k">Next exit</span>
          <b className="stat__v">{next ? formatCountdown(remainingMs(next.expectedExitAt, now)) : "—"}</b>
          <span className="stat__sub">{next ? `${next.label} · ${shortAddress(next.address)}` : "every hand is past its time"}</span>
        </div>
      </Reveal>

      <section className="clock__dial panel" aria-label={`${token.symbol} exit dial`}>
        <span className="panel__bolts" aria-hidden="true" />
        <Dial token={token} holders={holders} now={now} active={active} reduce={reduce} onSelect={toggle} onHover={setHovered} />
        <Plate token={token} holder={activeHolder} now={now} overdue={overdueNow} />
        <p className="dial__legend">hand length ∝ value held · angle = time to expected exit, log scale 1h → 30d · brass = overdue</p>
      </section>

      <div className="clock__ledger">
        <Ledger token={token} holders={holders} now={now} active={active} onSelect={toggle} onHover={setHovered} />
      </div>
    </div>
  );
}

/** The brass plate under the dial: the token's summary, or the hand under the pointer. */
function Plate({ token, holder, now, overdue }: { token: ExitToken; holder: Holder | null; now: number; overdue: number }) {
  if (!holder) {
    return (
      <div className="dial__plate">
        <span className="dial__plate-sym">${token.symbol}</span>
        <span className="dial__plate-meta">
          {token.chain} · {token.holders.length} hands · <em>{overdue} overdue</em> · median hold {formatHold(token.medianHoldHours)}
        </span>
        <span className="dial__plate-hint">hover or tap a hand</span>
      </div>
    );
  }
  const ms = remainingMs(holder.expectedExitAt, now);
  const trips = holder.holdSource === "trader" ? `${holder.pairs} round trip${holder.pairs === 1 ? "" : "s"}` : "token median";
  return (
    <div className={`dial__plate is-${exitState(ms)}`}>
      <span className="dial__plate-sym">{holder.label}</span>
      <span className="dial__plate-meta lg-addr">{shortAddress(holder.address, 6)}</span>
      <span className="dial__plate-time">
        {ms <= 0 ? "overdue by" : "exits in"} <b>{formatCountdown(ms)}</b>
      </span>
      <span className="dial__plate-meta">
        {fmt.usd(holder.valueUsd)} held · {fmt.pct(holder.ownershipPct, 2)} of supply · hold {formatHold(holder.avgHoldHours)} ({trips}) ·{" "}
        {anchorText(holder, now)}
      </span>
    </div>
  );
}
