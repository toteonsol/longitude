"use client";
import { AnimatePresence, motion } from "@longitude/motion";
import { useEffect, useState } from "react";
import type { AppMeta } from "../apps";

interface Props {
  app: AppMeta;
  /** Seconds the sentence stays up on first load before folding away. */
  autoHideAfter?: number;
}

const key = (id: string) => `longitude:explainer:${id}`;

/**
 * The one sentence a newbie needs, shown on first load, plus a persistent "What am I looking at?"
 * toggle so a pro can skip it and a newbie can bring it back.
 */
export function Explainer({ app, autoHideAfter = 9 }: Props) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(key(app.id)) === "1";
    } catch {
      /* private mode */
    }
    setReady(true);
    if (!seen) {
      setOpen(true);
      const t = setTimeout(() => {
        setOpen(false);
        try {
          localStorage.setItem(key(app.id), "1");
        } catch {
          /* ignore */
        }
      }, autoHideAfter * 1000);
      return () => clearTimeout(t);
    }
  }, [app.id, autoHideAfter]);

  const toggle = () => {
    setOpen((o) => !o);
    try {
      localStorage.setItem(key(app.id), "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="lg-explainer" data-ready={ready}>
      <button type="button" className="lg-explainer__toggle" onClick={toggle} aria-expanded={open} aria-controls="lg-explainer-panel">
        <span className="lg-explainer__q">?</span> What am I looking at?
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="lg-explainer-panel"
            className="lg-explainer__panel"
            role="note"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <p>{app.explainer}</p>
            <p className="lg-explainer__sig">{app.signature}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
