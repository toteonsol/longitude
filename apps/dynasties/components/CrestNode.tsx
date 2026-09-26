"use client";
import { NansenLink } from "@longitude/kit";
import { AnimatePresence, motion } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { useEffect, useRef, useState } from "react";
import { armsOf } from "@/lib/heraldry";
import { Crest } from "./Crest";

export interface Fact {
  k: string;
  v: string;
}

interface Props {
  address: string;
  size: number;
  /** "Patriarch", "Founder", "Bannerman"... */
  role: string;
  relation?: string;
  /** ISO timestamp of the tie. */
  at?: string;
  label?: string;
  txHash?: string;
  chain?: string;
  /** Extra rows in the scroll, e.g. the patriarch's numbers. */
  facts?: Fact[];
  /** Short address under the crest. */
  caption?: boolean;
  open: boolean;
  onHover: (on: boolean) => void;
  onToggle: () => void;
  className?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Mar 2026", UTC, identical on the server and the client. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

type Align = "start" | "center" | "end";

/** A crest you can hover or tap. The unrolled scroll beneath it tells the relation, the date and the label. */
export function CrestNode({ address, size, role, relation, at, label, txHash, chain, facts, caption = true, open, onHover, onToggle, className }: Props) {
  const btn = useRef<HTMLButtonElement>(null);
  const [align, setAlign] = useState<Align>("center");
  const arms = armsOf(address);

  // Keep the scroll on screen: lean it away from whichever viewport edge is close.
  useEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const half = 140;
    if (cx < half + 12) setAlign("start");
    else if (window.innerWidth - cx < half + 12) setAlign("end");
    else setAlign("center");
  }, [open]);

  const explorer = txHash && chain === "ethereum" ? `https://etherscan.io/tx/${txHash}` : undefined;

  return (
    <div className={`node${open ? " is-open" : ""}${className ? ` ${className}` : ""}`} style={{ "--crest-size": `${size}px` } as React.CSSProperties}>
      <button
        ref={btn}
        type="button"
        className="node__btn"
        aria-expanded={open}
        aria-label={`${role} ${shortAddress(address)}${relation ? `, ${relation}` : ""}`}
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") onHover(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") onHover(false);
        }}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        onClick={onToggle}
      >
        <span className="node__crest" data-crest>
          <Crest address={address} size={size} />
        </span>
        {caption ? (
          <span className="node__caption lg-addr" title={address}>
            {shortAddress(address)}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="scroll"
            data-align={align}
            role="tooltip"
            initial={{ opacity: 0, y: 6, scaleY: 0.92 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: 4, scaleY: 0.96 }}
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
          >
            <header className="scroll__head">
              <span className="scroll__role">{role}</span>
              {relation ? <span className="scroll__relation">{relation}</span> : null}
            </header>
            <dl className="scroll__facts">
              {label ? (
                <div>
                  <dt>Label</dt>
                  <dd>{label}</dd>
                </div>
              ) : null}
              {at ? (
                <div>
                  <dt>{role === "Founder" ? "First coin" : role === "Patriarch" ? "Since" : "Tied"}</dt>
                  <dd>{formatDate(at)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Address</dt>
                <dd className="lg-addr" title={address}>
                  {shortAddress(address, 6)} <NansenLink address={address} chain={chain} />
                </dd>
              </div>
              {facts?.map((f) => (
                <div key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </div>
              ))}
              <div className="scroll__arms">
                <dt>Arms</dt>
                <dd>{arms.blazon}</dd>
              </div>
            </dl>
            {explorer ? (
              <a className="scroll__link" href={explorer} target="_blank" rel="noreferrer">
                The tie, on Etherscan
              </a>
            ) : chain && chain !== "ethereum" ? (
              <span className="scroll__chain">Recorded on {chain}</span>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
