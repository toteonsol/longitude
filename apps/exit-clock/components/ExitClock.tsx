"use client";
import { ReactionBar, social, useIdentity } from "@longitude/kit";
import { NumberTicker, Reveal, fmt, useClock, useMounted, useReducedMotion } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { useMemo, useState } from "react";
import { anchorText, exitState, formatCountdown, formatHold, remainingMs } from "@/lib/clock";
import type { ExitClockData, ExitToken, Holder } from "@/lib/data";
import { Dial } from "./Dial";
import { Ledger } from "./Ledger";
import { Pin } from "./Pin";
import { TokenTabs } from "./TokenTabs";
import { type WatchData, useWatchlist, watchId } from "./useWatchlist";

export function ExitClock({ data }: { data: ExitClockData }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  /** The last hand the pointer touched keeps the plate (and its Watch button) in place after the pointer leaves. */
  const [lastHovered, setLastHovered] = useState<string | null>(null);
  const mounted = useMounted();
  const clock = useClock(1000);
  const reduce = Boolean(useReducedMotion());
  const me = useIdentity();
  const watch = useWatchlist();
  // Server and first client render both use the snapshot instant so hydration matches; then the live clock takes over.
  const generated = Date.parse(data.generatedAt);
  const now = mounted ? clock : generated;
  const token: ExitToken | undefined = data.tokens[index] ?? data.tokens[0];
  const holders = useMemo(
    () => (token ? [...token.holders].sort((a, b) => Date.parse(a.expectedExitAt) - Date.parse(b.expectedExitAt)) : []),
    [token],
  );
  /** Fresh expectedExitAt for every hand in this snapshot, so watched hands from any token count down on current data. */
  const fresh = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of data.tokens) for (const h of t.holders) m.set(watchId(t.chain, t.address, h.address), h.expectedExitAt);
    return m;
  }, [data]);
  if (!token) return <p className="lg-muted">Nothing to time: this snapshot has no tokens.</p>;

  const active = hovered ?? selected;
  const plateAddress = active ?? lastHovered;
  const plateHolder = plateAddress ? (holders.find((h) => h.address === plateAddress) ?? null) : null;
  const overdueNow = holders.filter((h) => remainingMs(h.expectedExitAt, now) <= 0).length;
  const next = holders.find((h) => remainingMs(h.expectedExitAt, now) > 0) ?? null;

  const hover = (address: string | null) => {
    setHovered(address);
    if (address) setLastHovered(address);
  };
  const pick = (i: number) => {
    setIndex(i);
    setSelected(null);
    setHovered(null);
    setLastHovered(null);
  };
  const toggle = (address: string) => setSelected((cur) => (cur === address ? null : address));

  const idOf = (h: Holder) => watchId(token.chain, token.address, h.address);
  const watchedHere = new Set(holders.filter((h) => watch.has(idOf(h))).map((h) => h.address));

  /** Watch / unwatch a hand. The first watched hand of a token also files the token and tells the feed. */
  const toggleWatch = (h: Holder) => {
    const id = idOf(h);
    if (watch.has(id)) {
      watch.remove(id);
      return;
    }
    const first = !watch.items.some((i) => i.data.chain === token.chain && i.data.tokenAddress === token.address);
    const item: WatchData = {
      symbol: token.symbol,
      chain: token.chain,
      tokenAddress: token.address,
      address: h.address,
      label: h.label,
      expectedExitAt: h.expectedExitAt,
      valueUsd: h.valueUsd,
    };
    watch.add(id, item);
    if (first) {
      const ms = remainingMs(h.expectedExitAt, now);
      const when = ms <= 0 ? `overdue by ${formatCountdown(-ms)}` : `exits in ${formatCountdown(ms)}`;
      void social.collect("watched-tokens", `${token.chain}:${token.address}`);
      void social.event("watch", `${me?.handle ?? "Someone"} is watching ${shortAddress(h.address, 4)} on $${token.symbol} (${when})`);
    }
  };

  /** A watched hand from the ledger's Watching block: switch to its token and pin it, if the snapshot still has it. */
  const jump = (w: WatchData) => {
    const i = data.tokens.findIndex((t) => t.chain === w.chain && t.address === w.tokenAddress);
    if (i < 0) return;
    setIndex(i);
    setSelected(w.address);
    setHovered(null);
    setLastHovered(w.address);
  };

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
            {token.tradersPaired} wallets with round trips in {token.tradesSampled} {token.tradesScope === "holders" ? "holder trades" : "trades"}
          </span>
        </div>
        <div className="stat">
          <span className="stat__k">Median hold</span>
          <b className="stat__v">{formatHold(token.medianHoldHours)}</b>
          <span className="stat__sub">30-day smart money sample</span>
        </div>
        <div className="stat stat--next">
          <span className="stat__k">Next exit</span>
          <b className="stat__v">{next ? formatCountdown(remainingMs(next.expectedExitAt, now)) : "···"}</b>
          <span className="stat__sub">{next ? `${next.label} · ${shortAddress(next.address)}` : "every hand is past its time"}</span>
        </div>
      </Reveal>

      <div className="clock__poll poll">
        <span className="poll__k">
          Crowd poll · ${token.symbol} · are you
        </span>
        <ReactionBar target={`exit:${token.chain}:${token.address}`} kinds={["holding", "out"]} glyphs={{ holding: "still holding", out: "already out" }} />
      </div>

      <section className="clock__dial panel" aria-label={`${token.symbol} exit dial`}>
        <span className="panel__bolts" aria-hidden="true" />
        <Dial token={token} holders={holders} now={now} active={active} reduce={reduce} watched={watchedHere} onSelect={toggle} onHover={hover} />
        <Plate token={token} holder={plateHolder} now={now} overdue={overdueNow} watched={plateHolder ? watchedHere.has(plateHolder.address) : false} onWatch={toggleWatch} />
        <p className="dial__legend">hand length ∝ value held · angle = time to expected exit, log scale 1h → 30d · brass = overdue · pin = watching</p>
      </section>

      <div className="clock__ledger">
        <Ledger
          token={token}
          holders={holders}
          now={now}
          active={active}
          watched={watchedHere}
          watching={watch.items}
          fresh={fresh}
          onSelect={toggle}
          onHover={hover}
          onWatch={toggleWatch}
          onUnwatch={(id) => watch.remove(id)}
          onJump={jump}
        />
      </div>
    </div>
  );
}

interface PlateProps {
  token: ExitToken;
  holder: Holder | null;
  now: number;
  overdue: number;
  watched: boolean;
  onWatch: (holder: Holder) => void;
}

/** The brass plate under the dial: the token's summary, or the hand under the pointer with its Watch toggle. */
function Plate({ token, holder, now, overdue, watched, onWatch }: PlateProps) {
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
      <span className="dial__plate-hint">{watched ? "pinned on the dial · in your ledger" : "tap a hand to keep it here"}</span>
      <button type="button" className={`plate__watch${watched ? " is-on" : ""}`} aria-pressed={watched} onClick={() => onWatch(holder)}>
        <Pin on={watched} />
        {watched ? "Watching" : "Watch"}
      </button>
    </div>
  );
}
