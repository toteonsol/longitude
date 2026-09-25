"use client";
import { useCallback, useState } from "react";
import type { WalletObituariesData } from "@/lib/data";
import { longDate } from "@/lib/format";
import { Masthead } from "./Masthead";
import { Notices } from "./Notices";
import { Obituary } from "./Obituary";

/**
 * The compositor. `stage` walks down the page: 1 sets the lead headline, 2 its deck, 3 + k the k-th
 * column headline; a body fades up the moment its headline is set. Every line holds its measure from
 * the first paint, so the columns never reflow while the type goes in.
 */
export function FrontPage({ data }: { data: WalletObituariesData }) {
  const [stage, setStage] = useState(1);
  const reach = useCallback((s: number) => setStage((cur) => Math.max(cur, s)), []);
  const [lead, ...rest] = data.obituaries;
  const finalStage = 4 + rest.length;
  const done = stage >= finalStage;

  if (!lead) {
    return (
      <div className="paper">
        <Masthead edition={data.edition} />
        <p className="paper__empty">
          No retirements to report. The tape recorded no smart money exits of note on {longDate(data.edition.date)}; the desk will try again
          tomorrow.
        </p>
      </div>
    );
  }

  return (
    <div className="paper">
      <Masthead edition={data.edition} />
      <div className="paper__compositor">
        {done ? (
          <span className="paper__set">Page set · {data.obituaries.length} notices</span>
        ) : (
          <button type="button" className="paper__setall" onClick={() => reach(finalStage)}>
            Set the whole page at once ›
          </button>
        )}
      </div>
      <section className="paper__top">
        <Obituary
          o={lead}
          index={0}
          lead
          headlineActive={stage >= 1}
          deckActive={stage >= 2}
          bodyVisible={stage >= 3}
          onHeadlineDone={() => reach(2)}
          onDeckDone={() => reach(3)}
        />
        <Notices data={data} visible={stage >= 3} />
      </section>
      <section className="paper__columns" aria-label="Further notices">
        {rest.map((o, k) => (
          <Obituary
            key={`${o.address}-${o.exit.txHash}`}
            o={o}
            index={k + 1}
            headlineActive={stage >= 3 + k}
            bodyVisible={stage >= 4 + k}
            onHeadlineDone={() => reach(4 + k)}
          />
        ))}
      </section>
      <p className="paper__end">
        <span aria-hidden="true">❧</span> The notices continue in tomorrow's edition <span aria-hidden="true">❧</span>
      </p>
    </div>
  );
}
