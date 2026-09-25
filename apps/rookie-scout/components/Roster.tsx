"use client";
import { Leaderboard, ShareButton, social, useIdentity } from "@longitude/kit";
import { AnimatePresence, fmt, motion } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { useCallback, useEffect, useState } from "react";
import type { Prospect, RookieScoutData } from "@/lib/data";

export interface RosterItem {
  id: string;
  addedAt: string;
  data: { address: string; chain: string; symbol: string; similarity: number; grade: string; pnlUsd: number };
}

export const rosterKey = (p: Pick<Prospect, "chain" | "address">) => `${p.chain}:${p.address.toLowerCase()}`;

export function useRoster() {
  const [items, setItems] = useState<RosterItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void social.items("roster").then((r) => {
      if (r?.ok) setItems(r.items as RosterItem[]);
      setLoaded(true);
    });
  }, []);
  const has = useCallback((p: Prospect) => items.some((i) => i.id === rosterKey(p)), [items]);
  const draft = useCallback(async (p: Prospect, handle: string) => {
    const id = rosterKey(p);
    const data = { address: p.address, chain: p.chain, symbol: p.spottedOn.symbol, similarity: p.similarity, grade: p.grade, pnlUsd: p.stats.pnlUsd };
    setItems((cur) => [{ id, addedAt: new Date().toISOString(), data }, ...cur.filter((i) => i.id !== id)]);
    await Promise.all([
      social.addItem("roster", id, data),
      social.collect("drafted", id),
      social.score("rookie-scout", 1),
      social.event("draft", `${handle} drafted ${shortAddress(p.address)} (grade ${p.grade}, ${p.similarity}/100) off the $${p.spottedOn.symbol} board`),
    ]);
  }, []);
  const release = useCallback(async (id: string) => {
    setItems((cur) => cur.filter((i) => i.id !== id));
    await social.removeItem("roster", id);
  }, []);
  return { items, loaded, has, draft, release };
}

export function Roster({ items, release, drafted }: { items: RosterItem[]; release: (id: string) => void; drafted: RookieScoutData["drafted"] }) {
  const me = useIdentity();
  const now = (id: string) => drafted?.[id];
  const text =
    items.length > 0
      ? `My Rookie Scout roster: ${items.length} prospect${items.length === 1 ? "" : "s"} that trade like smart money before the label lands (${items.map((i) => i.data.grade).join("")}). Built on @nansen_ai`
      : "Rookie Scout: draft the next smart money before the label lands. Built on @nansen_ai";
  return (
    <section className="roster" aria-label="My roster">
      <div className="roster__head">
        <h2 className="roster__title">
          My roster <span>{items.length} drafted</span>
        </h2>
        <ShareButton text={text} />
      </div>
      {items.length === 0 ? (
        <p className="roster__empty">Draft a prospect from the board below. Every seed re-scores your picks against that day&apos;s smart money, so you can see if you called it.</p>
      ) : (
        <ul className="roster__list">
          <AnimatePresence initial={false}>
            {items.map((i) => {
              const cur = now(i.id);
              const delta = cur ? cur.similarity - i.data.similarity : null;
              const pnlDelta = cur ? cur.stats.pnlUsd - i.data.pnlUsd : null;
              return (
                <motion.li key={i.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }} className={`roster__item grade-${i.data.grade}`}>
                  <span className="roster__grade">{i.data.grade}</span>
                  <span className="roster__who">
                    <b className="lg-addr">{shortAddress(i.data.address, 5)}</b>
                    <small>
                      ${i.data.symbol} · {i.data.chain} · drafted at {i.data.similarity}/100
                    </small>
                  </span>
                  <span className="roster__now">
                    {cur ? (
                      <>
                        <b className={delta !== null && delta < 0 ? "is-down" : "is-up"}>
                          {cur.similarity}/100 {delta !== null ? `(${delta >= 0 ? "+" : ""}${delta})` : ""}
                        </b>
                        <small>
                          {pnlDelta !== null ? `${fmt.usdSigned(pnlDelta)} PnL since draft` : ""} · checked {new Date(cur.checkedAt).toLocaleDateString()}
                        </small>
                      </>
                    ) : (
                      <small>re-scored on the next seed</small>
                    )}
                  </span>
                  <button type="button" className="roster__release" onClick={() => release(i.id)} aria-label="Release from roster">
                    release
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <div className="roster__board">
        <Leaderboard board="rookie-scout" title="Top scouts" unit="drafts" refreshKey={items.length} />
        {me ? <p className="roster__me">Drafting as {me.handle}. No account needed; your roster follows you across the globe.</p> : null}
      </div>
    </section>
  );
}
