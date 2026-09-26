"use client";
import { NansenLink } from "@longitude/kit";
import { fmt } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import type { CastMember, Scene } from "@/lib/data";
import { VERB, hhmm } from "@/lib/format";

interface Props {
  scenes: Scene[];
  cast: CastMember[];
  /** 1-based index of the scene on screen, if any. */
  currentIndex?: number;
  onPick: (index: number) => void;
}

/** The TV guide: every scene in air order, with the trade behind it. Tap a row to jump. */
export function Rundown({ scenes, cast, currentIndex, onPick }: Props) {
  const byAddress = new Map(cast.map((m) => [m.address, m]));
  return (
    <section className="rundown" aria-label="Tonight's rundown">
      <h2 className="section__title">
        <span className="script">Tonight&rsquo;s rundown</span>
        <small>{scenes.length} scenes, in air order · times in UTC</small>
      </h2>
      <ol className="rundown__list">
        {scenes.map((s) => {
          const m = byAddress.get(s.wallet);
          const current = s.index === currentIndex;
          return (
            <li key={s.txHash || s.index} className={current ? "is-current" : undefined}>
              <button type="button" className="rundown__row" onClick={() => onPick(s.index)} aria-current={current ? "true" : undefined}>
                <span className="rundown__no">{s.index}</span>
                <span className="rundown__time lg-mono">{hhmm(s.at)}</span>
                <span className="rundown__who">{m?.character.name ?? shortAddress(s.wallet)}</span>
                <span className={`rundown__what rundown__what--${s.action}`}>
                  {VERB[s.action]} <b>${s.symbol}</b>
                  {s.action === "swap" ? <> from ${s.pair.sold.symbol}</> : null} · {fmt.usd(s.valueUsd)}
                </span>
                <span className="rundown__title">{s.title}</span>
                <span className={`rundown__zoom rundown__zoom--${s.zoom}`}>{s.zoom} zoom</span>
              </button>
              {/* The scene's wallet, beside the row's button (never inside it); globals.css lays it over the row's end. */}
              <NansenLink address={s.wallet} chain={s.chain} className="rundown__nansen" />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
