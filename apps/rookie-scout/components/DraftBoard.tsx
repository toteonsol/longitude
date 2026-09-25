"use client";
import { NumberTicker, Reveal, Stagger, StaggerItem, fmt } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { useState } from "react";
import type { Grade, RookieScoutData } from "@/lib/data";
import { ProspectCard } from "./ProspectCard";
import { Roster, useRoster } from "./Roster";
import { useIdentity } from "@longitude/kit";

const GRADES: Array<Grade | "all"> = ["all", "A", "B", "C"];

export function DraftBoard({ data }: { data: RookieScoutData }) {
  const [filter, setFilter] = useState<Grade | "all">("all");
  const [flipped, setFlipped] = useState<string | null>(null);
  const shown = data.prospects.filter((p) => filter === "all" || p.grade === filter);
  const m = data.cohort.medians;
  const roster = useRoster();
  const me = useIdentity();

  return (
    <div className="draft">
      <Reveal className="draft__board" spring="snappy">
        <div className="draft__cohort">
          <p className="draft__kicker">The veterans · {data.cohort.size} smart money wallets, last 30 days</p>
          <div className="draft__medians">
            <div>
              <b>
                <NumberTicker value={m.winRate} format={(n) => `${n.toFixed(0)}%`} />
              </b>
              <span>median win rate</span>
            </div>
            <div>
              <b>
                <NumberTicker value={m.pnlUsd} format={fmt.usd} />
              </b>
              <span>median PnL</span>
            </div>
            <div>
              <b>
                <NumberTicker value={m.trades} />
              </b>
              <span>median exits</span>
            </div>
            <div>
              <b>
                <NumberTicker value={m.tokens} />
              </b>
              <span>median tokens</span>
            </div>
          </div>
          <ul className="draft__vets">
            {data.cohort.veterans.map((v) => (
              <li key={v.address} title={v.address}>
                <span className="draft__vetlabel">{v.label}</span>
                <span className="lg-addr">{shortAddress(v.address)}</span>
                <span className="draft__vetpnl">{fmt.usdSigned(v.pnlUsd)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="draft__scouted">
          <p className="draft__kicker">Scouted on tokens smart money bought this week</p>
          <div className="draft__tokens">
            {data.tokensScouted.map((t) => (
              <span key={`${t.chain}:${t.address}`} className="draft__token">
                ${t.symbol} <small>{t.chain}</small> <em>{fmt.usdSigned(t.netFlow7dUsd)}</em>
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      <Roster items={roster.items} release={(id) => void roster.release(id)} drafted={data.drafted} />

      <div className="draft__bar">
        <h2 className="draft__title">
          Draft board <span>{shown.length} prospects</span>
        </h2>
        <div className="draft__filters" role="tablist" aria-label="Filter by grade">
          {GRADES.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={filter === g} className={`draft__filter${filter === g ? " is-on" : ""}`} onClick={() => setFilter(g)}>
              {g === "all" ? "All" : `Grade ${g}`}
            </button>
          ))}
        </div>
      </div>

      <Stagger className="draft__grid" gap={0.05}>
        {shown.map((p) => (
          <StaggerItem key={p.address} y={20}>
            <ProspectCard
              prospect={p}
              medians={m}
              flipped={flipped === p.address}
              onFlip={() => setFlipped(flipped === p.address ? null : p.address)}
              drafted={roster.has(p)}
              onDraft={() => void roster.draft(p, me?.handle ?? "Someone")}
            />
          </StaggerItem>
        ))}
      </Stagger>
      {shown.length === 0 ? <p className="lg-muted">No prospects at that grade.</p> : null}
    </div>
  );
}
