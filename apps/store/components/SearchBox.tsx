"use client";
import { appUrl, useIdentity, withIdentity } from "@longitude/kit";
import { AnimatePresence, fmt, motion } from "@longitude/motion";
import { useEffect, useRef, useState } from "react";
import type { WalletSuggestion } from "@/lib/suggestions";

interface Token {
  name?: string;
  symbol?: string;
  chain?: string;
  address?: string;
  price?: number | null;
  market_cap?: number | null;
}
interface Entity {
  name?: string;
  tags?: string[];
}
interface Result {
  ok: boolean;
  query: string;
  wallet: { address: string; chain: string } | null;
  tokens: Token[];
  entities: Entity[];
  error?: string;
}

/**
 * Find a token, an entity or a wallet across the globe. Zero Nansen credits per search. With nothing typed
 * it offers a few real wallets from the apps' current data, for anyone without an address to hand.
 */
export function SearchBox({ suggestions = [] }: { suggestions?: WalletSuggestion[] }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const me = useIdentity();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) {
      setRes(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const r = (await fetch(`/api/search?q=${encodeURIComponent(query)}`).then((x) => x.json())) as Result;
        setRes(r);
      } catch {
        setRes(null);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  const scoutUrl = (address: string) => withIdentity(`${appUrl("rookie-scout")}/scout/${encodeURIComponent(address)}`, me?.id);
  const lensUrl = (address: string, chain?: string) => `/wallet/${encodeURIComponent(address)}${chain ? `?chain=${chain}` : ""}`;
  const open = res && (res.wallet || res.tokens.length > 0 || res.entities.length > 0);
  const showSuggestions = !open && q.trim().length < 2 && suggestions.length > 0;

  return (
    <div className="search">
      <label className="search__label" htmlFor="globe-search">
        Find a token, an entity or a wallet
      </label>
      <div className="search__row">
        <input id="globe-search" className="search__input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="PEPE, Jump Trading, 0x… or a Solana address" spellCheck={false} autoComplete="off" />
        <span className={`search__spin${busy ? " is-on" : ""}`} aria-hidden="true" />
      </div>
      {showSuggestions ? (
        <div className="search__try">
          <span className="search__try-label">No wallet handy? Try one of these</span>
          <div className="search__try-list">
            {suggestions.map((s) => (
              <a key={s.address} className="search__try-item" href={lensUrl(s.address, s.chain)}>
                <b>{s.title}</b>
                <small>{s.source}</small>
                <span className="lg-addr">
                  {s.address.slice(0, 6)}…{s.address.slice(-4)}
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <AnimatePresence>
        {open ? (
          <motion.div className="search__results" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {res?.wallet ? (
              <>
              <a className="search__hit search__hit--wallet" href={lensUrl(res.wallet.address)}>
                <b>Read this wallet across ten meridians</b>
                <span className="lg-addr">{res.wallet.address.slice(0, 10)}…{res.wallet.address.slice(-6)}</span>
                <small>smart money score, perp face, holdings, kin, exits · about 5 credits</small>
              </a>
              <a className="search__hit" href={scoutUrl(res.wallet.address)}>
                <b>Scout it in Rookie Scout</b>
                <small>live scouting report · 1 credit</small>
              </a>
              </>
            ) : null}
            {res?.tokens.map((t, i) => (
              <div key={`${t.chain}-${t.address}-${i}`} className="search__hit">
                <b>${t.symbol ?? "?"}</b>
                <span>{t.name}</span>
                <small>
                  {t.chain}
                  {typeof t.price === "number" ? ` · $${t.price < 1 ? t.price.toPrecision(3) : t.price.toFixed(2)}` : ""}
                  {typeof t.market_cap === "number" ? ` · ${fmt.usd(t.market_cap)} mcap` : ""}
                </small>
              </div>
            ))}
            {res?.entities.map((e, i) => (
              <div key={`${e.name}-${i}`} className="search__hit">
                <b>{e.name}</b>
                <small>{(e.tags ?? []).slice(0, 3).join(" · ") || "entity"}</small>
              </div>
            ))}
            <small className="search__foot">Nansen search · 0 credits</small>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
