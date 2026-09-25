"use client";
import { AnimatePresence, Typewriter, fmt, motion, springs, useMotionValue, useReducedMotion, useSpring, useTransform } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { useEffect, useRef, useState } from "react";
import type { TwoFacedData } from "@/lib/data";
import { Mask } from "./Mask";
import { MorphDial } from "./MorphDial";
import { StatPanel } from "./StatPanel";
import { Vitals } from "./Vitals";
import { WalletPicker } from "./WalletPicker";

export function TwoFaced({ data }: { data: TwoFacedData }) {
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const interacted = useRef(false);
  const reduce = useReducedMotion();

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

  const wallet = data.wallets[index] ?? data.wallets[0];
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
            <h2 className="bill__verdict">
              <Typewriter text={wallet.verdict} speed={22} as="span" />
            </h2>
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
      </div>

      <p className="tf__feedline">
        Cast from {data.feed.trades} Hyperliquid perp trades by {data.feed.traders} smart money wallets in the last {Math.round(data.feed.lookbackHours / 24)}{" "}
        days · faces drawn from {data.window.from} to {data.window.to}
      </p>
    </div>
  );
}
