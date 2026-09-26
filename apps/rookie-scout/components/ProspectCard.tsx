"use client";
import { NansenLink } from "@longitude/kit";
import { Flip, Grow, NumberTicker, Tilt, fmt } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import type { CohortMedians, Prospect } from "@/lib/data";

interface Props {
  prospect: Prospect;
  medians: CohortMedians;
  flipped: boolean;
  onFlip: () => void;
  drafted?: boolean;
  onDraft?: () => void;
}

/** Deterministic jersey color from the address. */
function hue(address: string): number {
  let h = 0;
  for (let i = 2; i < Math.min(address.length, 14); i++) h = (h * 31 + address.charCodeAt(i)) % 360;
  return h;
}

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

export function ProspectCard({ prospect: p, medians: m, flipped, onFlip, drafted, onDraft }: Props) {
  const h = hue(p.address);
  const draftBtn = onDraft ? (
    <button
      type="button"
      className={`card__draft${drafted ? " is-drafted" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!drafted) onDraft();
      }}
      disabled={drafted}
    >
      {drafted ? "On your roster" : "Draft"}
    </button>
  ) : null;
  const front = (
    <div className={`card card--front grade-${p.grade}`} style={{ "--jersey": `hsl(${h} 55% 42%)` } as React.CSSProperties}>
      <div className="card__top">
        <span className="card__num">#{String(p.number).padStart(2, "0")}</span>
        <span className="card__chain">{p.chain}</span>
      </div>
      <div className="card__jersey">
        <span>{p.number}</span>
      </div>
      <div className="card__name lg-addr" title={p.address}>
        {shortAddress(p.address, 5)} <NansenLink address={p.address} chain={p.chain} />
      </div>
      <div className="card__pos">
        Spotted on <b>${p.spottedOn.symbol}</b>
      </div>
      <dl className="card__stats">
        <div>
          <dt>Win</dt>
          <dd>{p.stats.winRate.toFixed(0)}%</dd>
        </div>
        <div>
          <dt>PnL 90d</dt>
          <dd>{fmt.usdSigned(p.stats.pnlUsd)}</dd>
        </div>
        <div>
          <dt>Exits</dt>
          <dd>{p.stats.trades}</dd>
        </div>
      </dl>
      <div className="card__grade" aria-label={`grade ${p.grade}`}>
        {p.grade}
      </div>
      <div className="card__actions">
        {draftBtn}
        <span className="card__hint">tap to flip · scouting report</span>
      </div>
    </div>
  );

  const back = (
    <div className={`card card--back grade-${p.grade}`}>
      <div className="card__top">
        <span className="card__num">Scouting report</span>
        <span className={`card__verdict card__verdict--${p.verdict.toLowerCase()}`}>{p.verdict}</span>
      </div>
      <div className="card__score">
        <b>{flipped ? <NumberTicker value={p.similarity} format={(n) => `${Math.round(n)}`} duration={0.9} /> : p.similarity}</b>
        <span>similarity to smart money</span>
      </div>
      <Bar label="Win rate" value={p.stats.winRate} median={m.winRate} format={(n) => `${n.toFixed(0)}%`} />
      <Bar label="Realized PnL" value={Math.max(0, p.stats.pnlUsd)} median={m.pnlUsd} format={fmt.usd} />
      <Bar label="Exits" value={p.stats.trades} median={m.trades} format={fmt.int} />
      <Bar label="Tokens" value={p.stats.tokens} median={m.tokens} format={fmt.int} />
      <ul className="card__report">
        {p.report.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {p.topTokens.length ? (
        <div className="card__tokens">
          {p.topTokens.map((t, i) => (
            <span key={`${i}-${t}`}>${t}</span>
          ))}
        </div>
      ) : null}
      <div className="card__actions">
        {draftBtn}
        <span className="card__hint">tap to flip back</span>
      </div>
    </div>
  );

  return (
    <Tilt max={8} className="card__tilt">
      <Flip flipped={flipped} front={front} back={back} className="card__flip" onClick={onFlip} spring="snappy" />
    </Tilt>
  );
}
