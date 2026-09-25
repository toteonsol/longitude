"use client";
import { fmt, motion, springs } from "@longitude/motion";
import { remainingMs } from "@/lib/clock";
import type { ExitToken } from "@/lib/data";

interface Props {
  tokens: ExitToken[];
  index: number;
  now: number;
  onChange: (index: number) => void;
}

/** One pressed concrete key per token; a brass bar slides to the live one. */
export function TokenTabs({ tokens, index, now, onChange }: Props) {
  return (
    <div className="tabs" role="tablist" aria-label="Tokens">
      {tokens.map((t, i) => {
        const overdue = t.holders.filter((h) => remainingMs(h.expectedExitAt, now) <= 0).length;
        const on = i === index;
        return (
          <button key={`${t.chain}:${t.address}`} type="button" role="tab" aria-selected={on} className={`tab${on ? " is-on" : ""}`} onClick={() => onChange(i)}>
            {on ? <motion.span layoutId="tab-brass" className="tab__brass" transition={springs.snappy} aria-hidden="true" /> : null}
            <span className="tab__sym">${t.symbol}</span>
            <span className="tab__flow">{fmt.usdSigned(t.netFlow7dUsd)} · 7d</span>
            <span className="tab__meta">
              <span>{t.chain}</span>
              <span>
                {t.holders.length} hands · {overdue} overdue
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
