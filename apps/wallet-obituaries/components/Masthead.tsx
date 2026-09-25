"use client";
import { Reveal } from "@longitude/motion";
import type { Edition } from "@/lib/data";
import { longDate, roman } from "@/lib/format";

export function Masthead({ edition }: { edition: Edition }) {
  return (
    <Reveal className="masthead" y={-10} blur={3} spring="gentle">
      <div className="masthead__ears">
        <span>
          Vol. {roman(edition.volume)} · No. {edition.number.toLocaleString("en-US")}
        </span>
        <span>Late edition · Price: one gwei</span>
      </div>
      <h2 className="masthead__name">The Daily Ledger</h2>
      <div className="masthead__dateline">
        <span className="masthead__date">{longDate(edition.date)}</span>
        <span className="masthead__chains">Ethereum · Solana · Base</span>
      </div>
      <p className="masthead__section">
        <span aria-hidden="true">❧</span> Obituaries &amp; Retirements <span aria-hidden="true">❧</span>
      </p>
    </Reveal>
  );
}
