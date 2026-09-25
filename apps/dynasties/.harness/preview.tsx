/**
 * Static visual harness (no server): renders the real components to HTML with the app CSS so the
 * crests, ribbons, scroll and ornaments can be eyeballed in the browser pane via file://.
 * Run from apps/dynasties: node --import tsx <this file>
 */
import { readFileSync, writeFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Crest } from "/Users/terryajayi/nansen longitude/apps/dynasties/components/Crest";
import { CrestNode } from "/Users/terryajayi/nansen longitude/apps/dynasties/components/CrestNode";
import { Coronet, Rule } from "/Users/terryajayi/nansen longitude/apps/dynasties/components/Ornaments";
import { armsOf, houseName } from "/Users/terryajayi/nansen longitude/apps/dynasties/lib/heraldry";

const snap = JSON.parse(readFileSync("/Users/terryajayi/nansen longitude/apps/dynasties/snapshots/main.json", "utf8"));
const houses = snap.data.houses as Array<{ name: string; patriarch: { address: string; label: string }; members: Array<{ address: string; relation: string; at: string; label: string; kind: string; txHash: string }>; branches: Array<{ title: string; relation: string; count: number }> }>;

const baseCss = readFileSync("/Users/terryajayi/nansen longitude/packages/kit/src/styles/base.css", "utf8");
const appCss = readFileSync("/Users/terryajayi/nansen longitude/apps/dynasties/app/globals.css", "utf8");

const noop = () => {};
const allAddresses = houses.flatMap((h) => [h.patriarch.address, ...h.members.map((m) => m.address)]);
const h0 = houses[0]!;
const m0 = h0.members[0]!;

const body = renderToStaticMarkup(
  <div className="lg-frame">
    <main className="lg-frame__main">
      <div className="realm">
        <div className="realm__head">
          <p className="realm__eyebrow">ethereum · smart money · 30-day PnL leaderboard</p>
          <h2 className="realm__title">The Great Houses</h2>
          <Rule className="realm__rule" />
          <p className="realm__lede">Six patriarchs of the smart money, their founders and their kin, drawn as a roll of arms.</p>
        </div>

        <section className="house" data-unfurled="true" style={{ marginTop: 30 }}>
          <div className="house__cloth">
            <span className="house__corner house__corner--tl" />
            <span className="house__corner house__corner--tr" />
            <span className="house__corner house__corner--bl" />
            <span className="house__corner house__corner--br" />
            <div className="tree" data-layout="row">
              <div className="house__head" data-node="patriarch">
                <div className="tree__founder">
                  <span className="tree__eyebrow">Founded by</span>
                  <CrestNode address={allAddresses[7]!} size={52} role="Founder" relation="First funder" open={false} onHover={noop} onToggle={noop} />
                </div>
                <div className="house__patriarch">
                  <Coronet />
                  <CrestNode address={h0.patriarch.address} size={108} role="Patriarch" caption={false} open={false} onHover={noop} onToggle={noop} />
                </div>
                <div className="house__titles">
                  <p className="house__eyebrow">House 1 of 6 · Smart Trader (sample)</p>
                  <h2 className="house__name">House {h0.name}</h2>
                  <p className="house__motto">“What was given, we give again”</p>
                </div>
                <div className="house__stats">
                  <div><b>+$2.14M</b><span>PnL 30d</span></div>
                  <div><b>71%</b><span>Win rate</span></div>
                  <div><b>212</b><span>Trades</span></div>
                  <div><b>38</b><span>Tokens</span></div>
                </div>
                <div className="house__line"><span>Line recorded since 14 May 2021</span><span className="house__dot">·</span><span>7 kin across 4 bloodlines</span></div>
              </div>
              <div className="tree__branches" style={{ "--branches": h0.branches.length } as React.CSSProperties}>
                {h0.branches.map((b, bi) => (
                  <div className="branch" key={b.relation}>
                    <div className="branch__head">
                      <div className="ribbon" data-node="ribbon"><span className="ribbon__title">{b.title}</span><span className="ribbon__sub">{b.relation} · {b.count}</span></div>
                    </div>
                    <ol className="branch__members">
                      {h0.members.filter((m) => m.relation === b.relation).map((m, j) => (
                        <li key={m.address} data-node="member" data-branch={bi}>
                          <div>
                            <CrestNode address={m.address} size={56} role="Bannerman" relation={m.relation} at={m.at} label={m.label} txHash={m.txHash} chain="ethereum" open={bi === 2 && j === 0} onHover={noop} onToggle={noop} />
                            <span className="node__meta"><b>{m.label}</b><span>{m.relation}</span></span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="roll">
          <Rule label="Every crest in the sample" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center", marginTop: 20 }}>
            {allAddresses.map((a) => (
              <div key={a} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 118, textAlign: "center" }}>
                <span className="node__crest"><Crest address={a} size={64} /></span>
                <small style={{ fontSize: 11, opacity: 0.75, marginTop: 6, lineHeight: 1.2 }}>{armsOf(a).blazon}</small>
                <small className="lg-addr" style={{ opacity: 0.5 }}>{houseName(a)}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  </div>,
);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dynasties static preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${baseCss}</style>
<style>:root{--font-display:"Cinzel";--font-body:"Cormorant Garamond";--font-mono:"IBM Plex Mono";}</style>
<style>${appCss}</style>
</head><body>${body}</body></html>`;

const out = "/private/tmp/claude-501/-Users-terryajayi-nansen-longitude/31afac77-d642-44d0-a669-a80baeac5288/scratchpad/preview.html";
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
