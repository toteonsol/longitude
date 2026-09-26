"use client";
import { NansenLink, ShareButton, caption, useIdentity } from "@longitude/kit";
import { Grow, NumberTicker, Reveal, fmt } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import Link from "next/link";
import type { CohortMedians, Prospect } from "@/lib/data";
import type { ScoutResult } from "@/lib/scout";
import { ScoutSearch } from "./ScoutSearch";
import { DRAFT_CAPTION, useRoster } from "./Roster";

function Bar({ label, value, median, format }: { label: string; value: number; median: number; format: (n: number) => string }) {
  const max = Math.max(value, median, 1e-9);
  return (
    <div className="card__bar">
      <div className="card__barhead">
        <span>{label}</span>
        <b>{format(value)}</b>
      </div>
      <div className="card__track">
        <Grow percent={(value / max) * 100} className="card__fill" spring="snappy" />
        <span className="card__median" style={{ left: `${(median / max) * 100}%` }} title={`smart money median ${format(median)}`} />
      </div>
    </div>
  );
}

export function ScoutReport({ result, medians: m, cohortSize }: { result: ScoutResult | { error: string }; medians: CohortMedians; cohortSize: number }) {
  const roster = useRoster();
  const me = useIdentity();
  if ("error" in result) {
    return (
      <div className="scout">
        <ScoutSearch />
        <Reveal className="scout__error">
          <h2>Couldn&apos;t scout that wallet</h2>
          <p>{result.error}</p>
          <Link href="/">Back to the draft board</Link>
        </Reveal>
      </div>
    );
  }
  const prospect: Prospect = {
    number: 0,
    address: result.address,
    chain: result.chain,
    spottedOn: { symbol: "lookup", address: "", pnlUsd: result.stats.pnlUsd, stillHoldingRatio: 0 },
    stats: result.stats,
    topTokens: result.topTokens,
    similarity: result.similarity,
    grade: result.grade,
    verdict: result.verdict,
    report: result.report,
  };
  const drafted = roster.has(prospect);
  return (
    <div className="scout">
      <ScoutSearch initial={result.address} />
      <Reveal className={`scout__report grade-${result.grade}`} spring="snappy">
        <div className="scout__head">
          <div>
            <p className="draft__kicker">Scouting report · {result.chain} · last 90 days · vs {cohortSize || "the"} smart money wallets</p>
            <div className="scout__id">
              <h2 className="scout__addr lg-addr" title={result.address}>
                {shortAddress(result.address, 8)}
              </h2>
              <NansenLink address={result.address} chain={result.chain} label="Open in Nansen Profiler" />
            </div>
          </div>
          <div className="scout__score">
            <b>
              <NumberTicker value={result.similarity} format={(n) => `${Math.round(n)}`} duration={1} />
            </b>
            <span>/100 similarity</span>
            <em className={`card__verdict card__verdict--${result.verdict.toLowerCase()}`}>{result.verdict}</em>
          </div>
        </div>
        {result.quiet ? <p className="scout__quiet">No exits on {result.chain} in the last 90 days. A quiet wallet reads as a rookie with no tape.</p> : null}
        <div className="scout__bars">
          <Bar label="Win rate" value={result.stats.winRate} median={m.winRate} format={(n) => `${n.toFixed(0)}%`} />
          <Bar label="Realized PnL" value={Math.max(0, result.stats.pnlUsd)} median={m.pnlUsd} format={fmt.usd} />
          <Bar label="Exits" value={result.stats.trades} median={m.trades} format={fmt.int} />
          <Bar label="Tokens" value={result.stats.tokens} median={m.tokens} format={fmt.int} />
        </div>
        <ul className="card__report scout__lines">
          {result.report.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {result.topTokens.length ? (
          <div className="card__tokens">
            {result.topTokens.map((t, i) => (
              <span key={`${i}-${t}`}>${t}</span>
            ))}
          </div>
        ) : null}
        <div className="scout__actions">
          <button
            type="button"
            className={`card__draft${drafted ? " is-drafted" : ""}`}
            disabled={drafted}
            onClick={() => {
              caption(DRAFT_CAPTION);
              void roster.draft(prospect, me?.handle ?? "Someone");
            }}
          >
            {drafted ? "On your roster" : "Draft this wallet"}
          </button>
          <ShareButton text={`I scouted ${shortAddress(result.address)} on Rookie Scout: ${result.similarity}/100 similarity to smart money, grade ${result.grade}. LONGITUDE, built on @nansen_ai`} />
          <Link href="/" className="scout__back">
            Back to the draft board
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
