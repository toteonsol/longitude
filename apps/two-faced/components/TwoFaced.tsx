"use client";
import { ReactionBar, ShareButton, social, useIdentity } from "@longitude/kit";
import { AnimatePresence, Typewriter, fmt, motion, springs, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { useEffect, useRef, useState } from "react";
import type { TwoFacedData, Wallet } from "@/lib/data";
import { Mask } from "./Mask";
import { MorphDial } from "./MorphDial";
import { StatPanel } from "./StatPanel";
import { Vitals } from "./Vitals";
import { WalletPicker } from "./WalletPicker";

const UNMASKED_KEY = "two-faced:unmasked";

function shareTextFor(w: Wallet): string {
  const s = w.spot.winRate.toFixed(0);
  const p = w.perp.winRate.toFixed(0);
  const wins =
    w.spot.trades === 0
      ? `has no spot record and wins ${p}% on perps`
      : w.perp.trades === 0
        ? `wins ${s}% on spot and has no perp record`
        : `wins ${s}% on spot and ${p}% on perps`;
  return `${shortAddress(w.address)} ${wins}. ${w.verdict.replace(/\.$/, "")}. Two-Faced, LONGITUDE, built on @nansen_ai`;
}

export function TwoFaced({ data }: { data: TwoFacedData }) {
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const interacted = useRef(false);
  const reduce = useReducedMotion();
  const me = useIdentity();
  const wallet = data.wallets[index] ?? data.wallets[0];

  // `target` is where the dial sits; `t` is the spring that everything on stage actually follows.
  const target = useMotionValue(0);
  const spring = useSpring(target, { stiffness: 190, damping: 24, mass: 0.7 });
  const t = reduce ? target : spring;
  const lightX = useTransform(t, [0, 1], ["22%", "78%"]);

  // A first-load flourish: the mask turns to its night face and back before anyone touches the dial.
  useEffect(() => {
    if (reduce) return;
    const up = setTimeout(() => {
      if (!interacted.current) target.set(1);
    }, 1300);
    const down = setTimeout(() => {
      if (!interacted.current) target.set(0);
    }, 3100);
    return () => {
      clearTimeout(up);
      clearTimeout(down);
    };
  }, [reduce, target]);

  // Meridian feed: the first time a visitor drags a wallet past the middle, the house hears about it.
  // Once per wallet per tab session; the automatic flourish does not count. Fire-and-forget, never awaited.
  const unmasked = useRef<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(UNMASKED_KEY);
      if (raw) unmasked.current = new Set(JSON.parse(raw) as string[]);
    } catch {
      /* private mode: the in-memory set still guards this page */
    }
  }, []);
  useMotionValueEvent(t, "change", (v) => {
    if (v < 0.5 || !interacted.current || !wallet || unmasked.current.has(wallet.address)) return;
    unmasked.current.add(wallet.address);
    try {
      sessionStorage.setItem(UNMASKED_KEY, JSON.stringify([...unmasked.current]));
    } catch {
      /* ignore */
    }
    void social.event("custom", `${me?.handle ?? "A stranger"} unmasked ${shortAddress(wallet.address)}: ${wallet.verdict}`);
  });

  if (!wallet) return <p className="lg-muted">The cast is empty: no smart money perp trades in the feed.</p>;

  const onInteract = () => {
    interacted.current = true;
    setTouched(true);
  };
  const a = wallet.activity;

  return (
    <div className="tf">
      <WalletPicker wallets={data.wallets} selected={index} t={t} onSelect={setIndex} />

      <div className="bill">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={wallet.address} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={springs.snappy}>
            <p className="bill__who">
              <span className="bill__rank">№ {wallet.rank}</span>
              <span className="lg-addr">{shortAddress(wallet.address, 5)}</span>
              <span className="bill__label">{wallet.label}</span>
              <span className="bill__duality">{wallet.duality}% two-faced</span>
            </p>
            <div className="bill__row">
              <h2 className="bill__verdict">
                <Typewriter text={wallet.verdict} speed={22} as="span" />
              </h2>
              <ShareButton text={shareTextFor(wallet)} label="Share this face" />
            </div>
            <p className="bill__feed">
              In the feed this week: {a.trades7d} perp trades · {fmt.usd(a.volume7dUsd)} notional · mostly {a.favoriteCoin || "—"} ·{" "}
              {Math.round(a.longShare * 100)}% long
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="stage">
        <StatPanel side="spot" wallet={wallet} t={t} />

        <div className="stage__center">
          <span className="stage__seam" aria-hidden="true" />
          <motion.span className="stage__light" style={{ left: lightX }} aria-hidden="true" />
          <div className="stage__maskbox">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={wallet.address}
                className="stage__mask"
                initial={{ opacity: 0, scale: 0.86, rotate: -4, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.9, rotate: 4, filter: "blur(8px)" }}
                transition={springs.snappy}
              >
                <Mask seed={wallet.address} spot={wallet.faces.spot} perp={wallet.faces.perp} t={t} blink title={`Mask of ${shortAddress(wallet.address)}`} />
              </motion.div>
            </AnimatePresence>
          </div>
          <Vitals wallet={wallet} t={t} />
          <MorphDial wallet={wallet} target={target} t={t} onInteract={onInteract} />
          <AnimatePresence>
            {!touched ? (
              <motion.p
                className="stage__hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 3.4, duration: 0.6 } }}
                exit={{ opacity: 0, transition: { duration: 0.25 } }}
              >
                drag to change masks
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        <StatPanel side="perp" wallet={wallet} t={t} />

        {/* The house votes. Keyed by wallet so a failed fetch never shows the previous wallet's count. */}
        <section className="crowd" aria-label="Crowd verdict">
          <p className="crowd__kicker">The house votes</p>
          <h3 className="crowd__title">Which face is real?</h3>
          <ReactionBar key={wallet.address} target={`face:${wallet.address}`} kinds={["saint", "degen"]} glyphs={{ saint: "Saint by day", degen: "Degen by night" }} />
          <p className="crowd__note">One vote per visitor per face. Tap again to take it back.</p>
        </section>
      </div>

      <p className="tf__feedline">
        Cast from {data.feed.trades} Hyperliquid perp trades by {data.feed.traders} smart money wallets in the last {Math.round(data.feed.lookbackHours / 24)}{" "}
        days · faces drawn from {data.window.from} to {data.window.to}
      </p>
    </div>
  );
}
