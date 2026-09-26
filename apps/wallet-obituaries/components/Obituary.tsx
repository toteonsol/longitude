"use client";
import { NansenLink } from "@longitude/kit";
import { NumberTicker, type Variants, motion, useReducedMotion } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import type { Obituary as Notice } from "@/lib/data";
import { chainName, explorer, qty, stamp, usd } from "@/lib/format";
import { Condolences } from "./Condolences";
import { Typeset } from "./Typeset";

interface Props {
  o: Notice;
  index: number;
  lead?: boolean;
  headlineActive: boolean;
  deckActive?: boolean;
  bodyVisible: boolean;
  onHeadlineDone: () => void;
  onDeckDone?: () => void;
}

const paragraphs: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.16, delayChildren: 0.05 } } };

/** One notice. The headline (and, for the lead, the deck) types in; everything below fades up after it. */
export function Obituary({ o, index, lead = false, headlineActive, deckActive = false, bodyVisible, onHeadlineDone, onDeckDone }: Props) {
  const reduce = useReducedMotion();
  const ex = explorer(o.chain);
  const para: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 6 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
  };
  return (
    <article id={`obit-${index}`} className={`obit${lead ? " obit--lead" : ""}`}>
      <p className="obit__kicker">
        <span>{lead ? "Lead notice" : `Notice ${index + 1}`}</span>
        <span>
          {chainName(o.chain)} · {o.label}
        </span>
      </p>
      <Typeset
        as={lead ? "h2" : "h3"}
        className="obit__headline"
        text={o.headline}
        active={headlineActive}
        speed={lead ? 34 : 16}
        delay={lead ? 700 : 140}
        onDone={onHeadlineDone}
      />
      {lead ? <Typeset as="p" className="obit__deck" text={o.deck} active={deckActive} speed={11} delay={260} onDone={onDeckDone} /> : null}
      <motion.div className="obit__body" variants={paragraphs} initial="hidden" animate={bodyVisible ? "shown" : "hidden"} aria-hidden={!bodyVisible}>
        {lead ? null : (
          <motion.p className="obit__deck" variants={para}>
            {o.deck}
          </motion.p>
        )}
        <motion.p className="obit__byline" variants={para}>
          By the Smart Money desk · {stamp(o.exit.at)}
        </motion.p>
        <motion.div variants={para}>
          <ExitNotice o={o} live={bodyVisible} />
        </motion.div>
        <div className="obit__text">
          {o.body.map((p, i) => (
            <motion.p key={i} variants={para}>
              {p}
            </motion.p>
          ))}
        </div>
        <motion.div variants={para}>
          <SurvivedBy o={o} />
        </motion.div>
        <motion.p className="obit__continued" variants={para}>
          <a href={ex.tx(o.exit.txHash)} target="_blank" rel="noreferrer">
            Continued on {ex.name}, tx {shortAddress(o.exit.txHash, 5)} ›
          </a>
        </motion.p>
        <motion.div className="obit__condolences" variants={para}>
          <Condolences o={o} />
        </motion.div>
      </motion.div>
    </article>
  );
}

/** The classified-style box: what was sold, for what, when, by whom. */
function ExitNotice({ o, live }: { o: Notice; live: boolean }) {
  const ex = explorer(o.chain);
  return (
    <dl className="notice">
      <div>
        <dt>Sold</dt>
        <dd>
          {qty(o.exit.amount)} {o.exit.symbol}
          <NansenLink kind="token" address={o.exit.tokenAddress} chain={o.chain} className="obit-nansen" />
        </dd>
      </div>
      <div>
        <dt>For</dt>
        <dd>
          <NumberTicker value={live ? o.exit.valueUsd : 0} format={usd} duration={1.6} /> <small>in {o.exit.into}</small>
        </dd>
      </div>
      <div>
        <dt>When</dt>
        <dd>{stamp(o.exit.at)}</dd>
      </div>
      <div>
        <dt>Wallet</dt>
        <dd>
          <a className="lg-addr" href={ex.address(o.address)} target="_blank" rel="noreferrer" title={o.address}>
            {shortAddress(o.address, 5)}
          </a>
          <NansenLink address={o.address} chain={o.chain} className="obit-nansen" />
        </dd>
      </div>
    </dl>
  );
}

/** The holdings that outlive the position, set with dotted leaders. */
function SurvivedBy({ o }: { o: Notice }) {
  if (!o.survivedBy.length) {
    return <p className="survived survived--none">Survived by no holdings of note on {chainName(o.chain)}.</p>;
  }
  return (
    <div className="survived">
      <h4 className="survived__title">Survived by</h4>
      <ul className="survived__list">
        {o.survivedBy.map((h, i) => (
          <li key={`${h.symbol}-${i}`}>
            <span className="survived__sym">${h.symbol}</span>
            <span className="survived__leader" aria-hidden="true" />
            <span className="survived__val">{usd(h.valueUsd)}</span>
          </li>
        ))}
      </ul>
      <p className="survived__estate">
        <span>Estate</span>
        <span className="survived__leader" aria-hidden="true" />
        <b>{usd(o.estateUsd)}</b>
      </p>
    </div>
  );
}
