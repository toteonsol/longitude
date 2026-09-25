"use client";
import { ShareButton, social, useIdentity, useReactions } from "@longitude/kit";
import { AnimatePresence, motion, useReducedMotion } from "@longitude/motion";
import { useCallback, useEffect } from "react";
import { Pennant } from "./Ornaments";

/** One reaction kind per house; its count is the house's followers. */
export const FEALTY_KIND = "banner";
const MAX_FLAGS = 24;

const rememberKey = (address: string) => `longitude:dynasties:fealty:${address.toLowerCase()}`;
const remembered = (address: string): boolean => {
  try {
    return localStorage.getItem(rememberKey(address)) === "1";
  } catch {
    return false;
  }
};
const remember = (address: string): void => {
  try {
    localStorage.setItem(rememberKey(address), "1");
  } catch {
    /* private mode */
  }
};

export interface FealtyState {
  /** Followers of the house (live count, 0 until the social API answers). */
  count: number;
  /** Whether this visitor has sworn. */
  sworn: boolean;
  swear: () => void;
}

/**
 * Fealty to one house: a `banner` reaction on `house:<patriarch>`. Every call is fire-and-forget
 * through the kit, so with the social API unreachable the count stays 0 and nothing else changes.
 * The first time a visitor swears to a house, one feed event is published.
 */
export function useFealty(address: string, name: string, onCount?: (address: string, count: number) => void): FealtyState {
  const { counts, mine, toggle } = useReactions(`house:${address}`, [FEALTY_KIND]);
  const me = useIdentity();
  const sworn = mine.includes(FEALTY_KIND);
  const count = counts[FEALTY_KIND] ?? 0;

  useEffect(() => {
    onCount?.(address, count);
  }, [address, count, onCount]);

  const swear = useCallback(() => {
    const first = !sworn && !remembered(address);
    void toggle(FEALTY_KIND);
    if (first) {
      remember(address);
      void social.event("custom", `${me?.handle ?? "A visitor"} swore fealty to House ${name}`);
    }
  }, [address, name, sworn, toggle, me]);

  return { count, sworn, swear };
}

/** A row of tiny pennants under the patriarch's crest, one per follower; the visitor's own burns brighter. */
export function BannerRow({ count, sworn }: { count: number; sworn: boolean }) {
  const reduce = useReducedMotion();
  const shown = Math.min(count, MAX_FLAGS);
  const flags = Array.from({ length: shown }, (_, i) => i);
  return (
    <div className="banners" aria-live="polite">
      <div className="banners__row" aria-hidden={shown === 0}>
        <AnimatePresence initial={false}>
          {flags.map((i) => (
            <motion.span
              key={i}
              className={`banners__flag${sworn && i === 0 ? " is-mine" : ""}`}
              initial={reduce ? false : { opacity: 0, y: -6, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: sworn && i === 0 ? 1.15 : 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 420, damping: 24, delay: Math.min(i, 12) * 0.03 }}
            >
              <Pennant />
            </motion.span>
          ))}
        </AnimatePresence>
        {count > MAX_FLAGS ? <span className="banners__more">+{count - MAX_FLAGS}</span> : null}
      </div>
      <span className="banners__caption">
        {count === 0 ? "No banners sworn yet" : count === 1 ? (sworn ? "Your banner flies alone" : "One banner sworn") : `${count} banners sworn`}
      </span>
    </div>
  );
}

/** "Swear fealty" pennant button plus the house's share button. */
export function FealtyActions({ fealty, name, blazon }: { fealty: FealtyState; name: string; blazon: string }) {
  return (
    <div className="house__actions">
      <button type="button" className={`fealty__btn${fealty.sworn ? " is-sworn" : ""}`} onClick={fealty.swear} aria-pressed={fealty.sworn}>
        <Pennant />
        {fealty.sworn ? "Fealty sworn" : "Swear fealty"}
      </button>
      <ShareButton text={`I swore fealty to House ${name} (${blazon}). Dynasties, LONGITUDE, built on @nansen_ai`}>Proclaim on X</ShareButton>
    </div>
  );
}
