"use client";
import { Reveal, Stagger, StaggerItem } from "@longitude/motion";
import type { Bout, OddsVsFlowData } from "@/lib/data";
import { BettingSlip } from "./BettingSlip";
import { River } from "./River";
import { Rope } from "./Rope";

const RELATION_STAMP: Record<Bout["relation"], string> = {
  contested: "Contested",
  aligned: "Same side",
  unopposed: "Unopposed",
};

/** Knot within ±0.1 of centre reads as even. */
const EVEN = 0.1;

function cardDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function Arena({ data }: { data: OddsVsFlowData }) {
  const smart = data.bouts.filter((b) => b.pull > EVEN).length;
  const crowd = data.bouts.filter((b) => b.pull < -EVEN).length;
  const even = data.bouts.length - smart - crowd;

  return (
    <div className="arena">
      <Reveal className="card" spring="snappy" y={10}>
        <div className="card__head">
          <span className="card__kicker">Tonight's card · {cardDate(data.generatedAt)}</span>
          <h2 className="card__title">
            {data.bouts.length} {data.bouts.length === 1 ? "bout" : "bouts"}, one rope each
          </h2>
        </div>
        <div className="card__tally" role="group" aria-label="Ropes held">
          <div className="card__team card__team--crowd">
            <b>{crowd}</b>
            <span>crowd</span>
          </div>
          <span className="card__vs">{even ? `${even} even` : "vs"}</span>
          <div className="card__team card__team--smart">
            <b>{smart}</b>
            <span>smart money</span>
          </div>
        </div>
        <p className="card__legend">
          <span>◀ crowd pulling</span>
          <span>smart money pulling ▶</span>
        </p>
      </Reveal>

      <Stagger className="bouts" gap={0.14} delay={0.1}>
        {data.bouts.map((b) => (
          <StaggerItem key={b.id} y={26}>
            <BoutRow bout={b} />
          </StaggerItem>
        ))}
      </Stagger>
      {data.bouts.length === 0 ? <p className="lg-muted">No open price market matched a smart money flow. Refresh live to try again.</p> : null}
    </div>
  );
}

function BoutRow({ bout: b }: { bout: Bout }) {
  const crowdLabel = `${b.market.yesPct}¢ yes · conviction ${b.crowd.conviction.toFixed(2)}`;
  const flowLabel = `${b.flow.stance} · strength ${b.flow.strength.toFixed(2)}`;
  return (
    <article className="bout" aria-label={`Bout ${b.number}: ${b.asset.name}`}>
      <div className="bout__slip">
        <BettingSlip bout={b} />
      </div>
      <div className="bout__ring">
        <header className="bout__tape">
          <span className="bout__num">Bout {String(b.number).padStart(2, "0")}</span>
          <h3 className="bout__asset">{b.asset.name}</h3>
          <span className={`stamp stamp--${b.relation}`}>{RELATION_STAMP[b.relation]}</span>
        </header>
        <Rope pull={b.pull} relation={b.relation} crowd={b.crowd.conviction} flow={b.flow.strength} crowdLabel={crowdLabel} flowLabel={flowLabel} />
        <p className="bout__verdict">{b.verdict}</p>
      </div>
      <div className="bout__river">
        <River bout={b} />
      </div>
    </article>
  );
}
