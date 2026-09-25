"use client";
import { NumberTicker, type Variants, motion, useReducedMotion } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import type { WalletObituariesData } from "@/lib/data";
import { chainName, usd } from "@/lib/format";

const list: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } };

/** The right-hand rail: the day's ledger and an index of every notice on the page. */
export function Notices({ data, visible }: { data: WalletObituariesData; visible: boolean }) {
  const reduce = useReducedMotion();
  const item: Variants = {
    hidden: { opacity: 0, x: reduce ? 0 : 8 },
    shown: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };
  const retiredUsd = data.obituaries.reduce((s, o) => s + o.exit.valueUsd, 0);
  const estateUsd = data.obituaries.reduce((s, o) => s + o.estateUsd, 0);
  return (
    <motion.aside className="rail" variants={list} initial="hidden" animate={visible ? "shown" : "hidden"} aria-label="Today's notices" aria-hidden={!visible}>
      <motion.h3 className="rail__title" variants={item}>
        Today's notices
      </motion.h3>
      <motion.dl className="rail__ledger" variants={item}>
        <div>
          <dt>Retired</dt>
          <dd>
            <NumberTicker value={visible ? retiredUsd : 0} format={usd} duration={1.8} />
          </dd>
        </div>
        <div>
          <dt>Wallets</dt>
          <dd>{data.obituaries.length}</dd>
        </div>
        <div>
          <dt>Estates</dt>
          <dd>
            <NumberTicker value={visible ? estateUsd : 0} format={usd} duration={1.8} />
          </dd>
        </div>
      </motion.dl>
      <ol className="rail__list">
        {data.obituaries.map((o, i) => (
          <motion.li key={`${o.address}-${o.exit.txHash}`} variants={item}>
            <a href={`#obit-${i}`}>
              <span className="rail__sym">${o.exit.symbol}</span>
              <span className="rail__who">
                {shortAddress(o.address, 4)} · {chainName(o.chain)}
              </span>
              <span className="rail__val">{usd(o.exit.valueUsd)}</span>
            </a>
          </motion.li>
        ))}
      </ol>
      <motion.p className="rail__foot" variants={item}>
        Six-month records from Nansen's profiler. An estate is the wallet's five largest holdings on the chain it retired from.
      </motion.p>
    </motion.aside>
  );
}
