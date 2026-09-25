"use client";
import { AnimatePresence, NumberTicker, Stagger, StaggerItem, type Transition, type Variants, fmt, motion, useReducedMotion } from "@longitude/motion";
import { useEffect, useState } from "react";
import type { Animal, AnimalChain, Herd, Species } from "@/lib/data";
import { Silhouette } from "./Silhouette";

interface Props {
  animal: Animal | null;
  species: Species | null;
  herd: Herd;
  onClose: () => void;
}

const CHAIN: Record<AnimalChain, string> = { ethereum: "Ethereum", base: "Base", solana: "Solana", evm: "EVM" };
const SHEET_QUERY = "(max-width: 720px)";
const spring: Transition = { type: "spring", stiffness: 260, damping: 28, mass: 0.9 };

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function Stat({ label, value, format, herd }: { label: string; value: number; format: (n: number) => string; herd: string }) {
  return (
    <div className="notes__stat">
      <dt>{label}</dt>
      <dd>
        <b>
          <NumberTicker value={value} format={format} duration={0.9} />
        </b>
        <small>{herd}</small>
      </dd>
    </div>
  );
}

/**
 * The journal page. A side page laid on the desk on wide screens, a bottom sheet on phones.
 * Keyed by address so hopping between animals turns the page.
 */
export function FieldNotes({ animal, species, herd, onClose }: Props) {
  const reduce = useReducedMotion();
  const sheet = useMediaQuery(SHEET_QUERY);

  useEffect(() => {
    if (!animal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [animal, onClose]);

  useEffect(() => {
    if (!animal || !sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [animal, sheet]);

  const variants: Variants = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1 }, gone: { opacity: 0 } }
    : sheet
      ? { hidden: { y: "100%" }, shown: { y: 0 }, gone: { y: "100%" } }
      : { hidden: { opacity: 0, y: 36, rotate: 2.5 }, shown: { opacity: 1, y: 0, rotate: -0.7 }, gone: { opacity: 0, y: 24, rotate: 1.5 } };

  const m = herd.medians;

  return (
    <>
      <AnimatePresence>
        {animal ? <motion.div key="scrim" className="notes__scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} /> : null}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {animal && species ? (
          <motion.aside
            key={animal.address}
            className={`notes notes--${animal.species}`}
            role="dialog"
            aria-modal={sheet}
            aria-labelledby="notes-title"
            variants={variants}
            initial="hidden"
            animate="shown"
            exit="gone"
            transition={reduce ? { duration: 0.2 } : spring}
          >
            <span className="notes__tape" aria-hidden="true" />
            <span className="notes__handle" aria-hidden="true" />
            <header className="notes__head">
              <span className="notes__kicker">Specimen no. {String(animal.number).padStart(2, "0")} · Plate I</span>
              <button type="button" className="notes__close" onClick={onClose} aria-label="Close field notes" autoFocus>
                ×
              </button>
            </header>
            <h2 id="notes-title" className="notes__species">
              {species.name}
            </h2>
            <p className="notes__latin">{species.latin}</p>

            <div className="notes__sketch">
              <Silhouette species={animal.species} variant="sketch" title={`Ink sketch of a ${species.name.toLowerCase()}`} />
            </div>

            <div className="notes__subject">
              <span className="notes__stamp">{animal.label}</span>
              <span className="notes__chain">{CHAIN[animal.chain]}</span>
              <code className="notes__addr">{animal.address}</code>
            </div>

            <dl className="notes__stats">
              <Stat label="Win rate" value={animal.stats.winRate} format={(n) => `${n.toFixed(0)}%`} herd={`herd ${m.winRate.toFixed(0)}%`} />
              <Stat label="PnL · 30d" value={animal.stats.pnlUsd} format={fmt.usdSigned} herd={`herd ${fmt.usd(m.pnlUsd)}`} />
              <Stat label="Trades" value={animal.stats.trades} format={fmt.int} herd={`herd ${fmt.int(m.trades)}`} />
              <Stat label="Tokens" value={animal.stats.tokens} format={fmt.int} herd={`herd ${fmt.int(m.tokens)}`} />
              <Stat label="Avg ROI" value={animal.stats.avgRoi} format={(n) => fmt.pctSigned(n, 0)} herd={`herd ${fmt.pctSigned(m.avgRoi, 0)}`} />
              <Stat label="Held" value={animal.stats.heldTokens} format={fmt.int} herd={`herd ${fmt.int(m.heldTokens)}`} />
            </dl>

            <h3 className="notes__h">Field notes</h3>
            <Stagger className="notes__list" gap={0.2} delay={0.45}>
              {animal.notes.map((note, i) => (
                <StaggerItem key={i} y={8}>
                  <p className="notes__note">{note}</p>
                </StaggerItem>
              ))}
            </Stagger>

            {animal.topTokens.length ? (
              <>
                <h3 className="notes__h">Seen feeding on</h3>
                <ul className="notes__tokens">
                  {animal.topTokens.map((t) => (
                    <li key={t}>${t}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <p className="notes__filed">
              Filed as <b>{species.name}</b>. {species.rule}
            </p>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}
