"use client";
import { NansenLink } from "@longitude/kit";
import { Stagger, StaggerItem, fmt } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import type { CastMember } from "@/lib/data";
import { Portrait } from "./Portrait";

interface Props {
  cast: CastMember[];
  activeAddress?: string;
  /** Scenes per wallet address. */
  sceneCounts: Map<string, number>;
  onPick: (member: CastMember) => void;
}

/** Tonight's cast, below the TV. Tap a card to jump to that character's next scene. */
export function CastStrip({ cast, activeAddress, sceneCounts, onPick }: Props) {
  return (
    <section className="cast" aria-label="Tonight's cast">
      <h2 className="section__title">
        <span className="script">Tonight&rsquo;s cast</span>
        <small>{cast.length} smart money wallets · tap one to jump to their scene</small>
      </h2>
      <Stagger className="cast__grid" gap={0.07} inView>
        {cast.map((m) => {
          const active = m.address === activeAddress;
          const scenes = sceneCounts.get(m.address) ?? 0;
          const s = m.stats;
          return (
            <StaggerItem key={m.address} y={18}>
              <article className={`castcard${active ? " is-active" : ""}`} onClick={() => onPick(m)}>
                <Portrait member={m} className="castcard__portrait" />
                <div className="castcard__head">
                  <h3 className="castcard__name script">{m.character.name}</h3>
                  <span className="castcard__archetype">{m.character.archetype}</span>
                </div>
                <p className="castcard__role">{m.character.role}</p>
                <p className="castcard__actor" title={m.address}>
                  played by <b>{m.label}</b> <span className="lg-addr">{shortAddress(m.address)}</span> · {m.chain}{" "}
                  <NansenLink address={m.address} chain={m.chain} />
                </p>
                <dl className="castcard__stats">
                  <div>
                    <dt>Today</dt>
                    <dd>{fmt.usd(s.volumeUsd)}</dd>
                    <small>
                      {s.trades} trade{s.trades === 1 ? "" : "s"}
                    </small>
                  </div>
                  <div>
                    <dt>30d PnL</dt>
                    <dd className={s.pnl30dUsd >= 0 ? "up" : "down"}>{fmt.usdSigned(s.pnl30dUsd)}</dd>
                    <small>{s.winRate30dPct.toFixed(0)}% win rate</small>
                  </div>
                  <div>
                    <dt>Scenes</dt>
                    <dd>{scenes}</dd>
                    <small>tonight</small>
                  </div>
                </dl>
                {s.tokens.length ? (
                  <div className="castcard__tokens">
                    {s.tokens.slice(0, 4).map((t, i) => (
                      <span key={`${i}-${t}`}>${t}</span>
                    ))}
                  </div>
                ) : null}
                <button type="button" className="castcard__jump" onClick={(e) => (e.stopPropagation(), onPick(m))} disabled={scenes === 0}>
                  {scenes ? "Jump to scene" : "No scenes tonight"}
                </button>
              </article>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
