"use client";
import { APP_BY_ID, Captions, NansenLink, Passport, ShareButton, appUrl, storeUrl, useIdentity, withIdentity } from "@longitude/kit";
import { NumberTicker, Reveal, Stagger, StaggerItem, fmt } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import type { CSSProperties } from "react";
import type { WalletSuggestion } from "@/lib/suggestions";
import type { WalletLens as Lens } from "@/lib/wallet";
import { SearchBox } from "./SearchBox";

const tint = (id: keyof typeof APP_BY_ID) => {
  const a = APP_BY_ID[id];
  return a.palette.accent.toLowerCase() === a.palette.ink.toLowerCase() ? a.palette.accent2 : a.palette.accent;
};

function Card({ app, title, children, cta, href }: { app: keyof typeof APP_BY_ID; title: string; children: React.ReactNode; cta: string; href: string }) {
  return (
    <StaggerItem className="lens__card" style={{ "--lens": tint(app), "--lens-bg": APP_BY_ID[app].palette.bg } as CSSProperties}>
      <span className="lens__app">{APP_BY_ID[app].name}</span>
      <h3 className="lens__title">{title}</h3>
      <div className="lens__body">{children}</div>
      <a className="lens__cta" href={href}>
        {cta} <span aria-hidden="true">→</span>
      </a>
    </StaggerItem>
  );
}

export function WalletLens({ lens, scoutUrl, suggestions = [] }: { lens: Lens | { error: string }; scoutUrl: string; suggestions?: WalletSuggestion[] }) {
  const me = useIdentity();
  const l = (id: keyof typeof APP_BY_ID) => withIdentity(appUrl(id), me?.id);
  return (
    <div className="lens">
      <header className="lens__head">
        <a className="lg-wordmark" href={storeUrl()}>
          <span className="lg-wordmark__globe" aria-hidden="true" />
          LONGITUDE
        </a>
        <span className="lg-frame__sep" aria-hidden="true">
          /
        </span>
        <span className="lens__kicker">wallet lens</span>
      </header>
      <div className="lens__search">
        <SearchBox suggestions={suggestions} />
      </div>
      {"error" in lens ? (
        <Reveal className="lens__error">
          <h1>Couldn&apos;t read that wallet</h1>
          <p>{lens.error}</p>
        </Reveal>
      ) : (
        <>
          <Reveal className="lens__hero" spring="snappy">
            <p className="lens__kicker">
              {lens.chain} · {lens.credits > 0 ? `read live from Nansen · ${lens.credits} credit${lens.credits === 1 ? "" : "s"}` : "read from Nansen minutes ago · cached"}
            </p>
            <h1 className="lens__addr lg-addr" title={lens.address}>
              {shortAddress(lens.address, 6)}
            </h1>
            <p className="lens__sub">One wallet, ten meridians. Here is what five of them see. Step into any of them to go deeper.</p>
            <div className="lens__actions">
              <NansenLink address={lens.address} chain={lens.chain} label="Open in Nansen Profiler" className="lens__nansen" />
              <ShareButton text={`${shortAddress(lens.address)} across ten meridians on LONGITUDE${lens.scout ? `: ${lens.scout.similarity}/100 similarity to smart money` : ""}. Built on @nansen_ai`} />
            </div>
          </Reveal>

          <Stagger className="lens__grid" gap={0.08}>
            <Card app="rookie-scout" title="Does it trade like smart money?" cta="Full scouting report" href={withIdentity(scoutUrl, me?.id)}>
              {lens.scout ? (
                <>
                  <div className="lens__big">
                    <b>
                      <NumberTicker value={lens.scout.similarity} />
                    </b>
                    <span>/100 similarity · grade {lens.scout.grade} · {lens.scout.verdict}</span>
                  </div>
                  <p>
                    Wins {lens.scout.winRate.toFixed(0)}% of {lens.scout.trades} exits across {lens.scout.tokens} tokens, {fmt.usdSigned(lens.scout.pnlUsd)} realized in 90 days
                    {lens.scout.topTokens.length ? `, mostly in ${lens.scout.topTokens.slice(0, 3).map((t) => `$${t}`).join(", ")}` : ""}.
                  </p>
                </>
              ) : (
                <p className="lg-muted">No spot exits in the last 90 days{lens.errors.scout ? ` (${lens.errors.scout})` : ""}.</p>
              )}
            </Card>

            <Card app="two-faced" title="What is its perp face?" cta="See both faces" href={l("two-faced")}>
              {lens.perp ? (
                <>
                  <div className="lens__big">
                    <b>{lens.perp.winRate.toFixed(0)}%</b>
                    <span>perp win rate · {fmt.usdSigned(lens.perp.pnlUsd)} realized</span>
                  </div>
                  <p>
                    {lens.perp.trades} perp trades on {lens.perp.coins} coins{lens.perp.topCoins.length ? `, best on ${lens.perp.topCoins.slice(0, 3).join(", ")}` : ""}.
                    {lens.scout ? (lens.perp.winRate > lens.scout.winRate + 10 ? " Sharper with leverage than without." : lens.perp.winRate + 10 < lens.scout.winRate ? " Calmer on spot than on perps." : " The same face on both sides.") : ""}
                  </p>
                </>
              ) : (
                <p className="lg-muted">{lens.chain === "solana" ? "Perp faces are read for EVM addresses on Hyperliquid." : "No Hyperliquid perp trades in the last 90 days."}</p>
              )}
            </Card>

            <Card app="exit-clock" title="What is it still holding?" cta="Watch the exit clocks" href={l("exit-clock")}>
              {lens.holdings && lens.holdings.length ? (
                <ul className="lens__list">
                  {lens.holdings.slice(0, 6).map((h) => (
                    <li key={h.symbol}>
                      <span>
                        ${h.symbol} <NansenLink kind="token" address={h.token} chain={h.chain ?? lens.chain} />
                      </span>
                      <b>{fmt.usd(h.valueUsd)}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="lg-muted">Nothing of value on this chain right now{lens.errors.holdings ? ` (${lens.errors.holdings})` : ""}.</p>
              )}
            </Card>

            <Card app="dynasties" title="Who is it related to?" cta="Explore the dynasties" href={l("dynasties")}>
              {lens.kin && lens.kin.count ? (
                <>
                  <div className="lens__big">
                    <b>
                      <NumberTicker value={lens.kin.count} />
                    </b>
                    <span>kin · {Object.entries(lens.kin.relations).map(([r, n]) => `${n} ${r.toLowerCase()}`).join(", ")}</span>
                  </div>
                  <ul className="lens__list">
                    {lens.kin.sample.map((k) => (
                      <li key={k.address}>
                        <span>
                          <span className="lg-addr">{shortAddress(k.address)}</span> <NansenLink address={k.address} chain={lens.chain} />
                        </span>
                        <b>{k.label || k.relation}</b>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="lg-muted">No recorded kin on this chain{lens.errors.kin ? ` (${lens.errors.kin})` : ""}.</p>
              )}
            </Card>

            <Card app="wallet-obituaries" title="What did it sell?" cta="Read the obituaries" href={l("wallet-obituaries")}>
              {lens.exits && lens.exits.length ? (
                <ul className="lens__list">
                  {lens.exits.map((e, i) => (
                    <li key={`${e.symbol}-${i}`}>
                      <span>
                        ${e.symbol}
                        {e.into ? ` → ${e.into}` : ""} <NansenLink kind="token" address={e.token} chain={lens.chain} />
                      </span>
                      <b>{fmt.usd(e.valueUsd)}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="lg-muted">No notable exits in the last 30 days{lens.errors.exits ? ` (${lens.errors.exits})` : ""}.</p>
              )}
            </Card>

            <Card app="rewind" title="Could you have called it?" cta="Play Rewind" href={l("rewind")}>
              <p>Rewind replays real past weeks of smart money buying. Lock a call, press play, and see whether this wallet&apos;s favourites were the ones that paid.</p>
            </Card>
          </Stagger>
        </>
      )}
      <footer className="lens__foot">
        <Passport />
        <a href={storeUrl()}>Back to the globe</a>
      </footer>
      <Captions
        kicker="Wallet lens"
        base={
          "error" in lens
            ? "Paste any Ethereum, Base or Solana wallet and five apps read it at once."
            : "One wallet read five ways by live Nansen calls: smart money likeness, perps, holdings, family and exits."
        }
      />
    </div>
  );
}
