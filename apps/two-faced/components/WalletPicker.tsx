"use client";
import { NansenLink } from "@longitude/kit";
import { type MotionValue, Stagger, StaggerItem, animate, motion, springs, useMotionValue, useMotionValueEvent } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { useEffect } from "react";
import type { Wallet } from "@/lib/data";
import { Mask } from "./Mask";

interface Props {
  wallets: Wallet[];
  selected: number;
  t: MotionValue<number>;
  onSelect: (index: number) => void;
}

function Seat({ wallet, selected, t, onSelect }: { wallet: Wallet; selected: boolean; t: MotionValue<number>; onSelect: () => void }) {
  // Each small mask has its own value: the selected one shadows the dial, the others rest on the spot face.
  const local = useMotionValue(0);
  useMotionValueEvent(t, "change", (v) => {
    if (selected) local.set(v);
  });
  useEffect(() => {
    if (selected) {
      local.set(t.get());
      return;
    }
    const controls = animate(local, 0, { duration: 0.45, ease: "easeOut" });
    return () => controls.stop();
  }, [selected, local, t]);

  return (
    <button type="button" role="tab" aria-selected={selected} className={`cast__seat${selected ? " is-on" : ""}`} onClick={onSelect} title={wallet.address}>
      <motion.span className="cast__mask" animate={{ scale: selected ? 1.1 : 1, y: selected ? -5 : 0 }} whileHover={{ scale: 1.08 }} transition={springs.snappy}>
        <Mask seed={wallet.address} spot={wallet.faces.spot} perp={wallet.faces.perp} t={local} title={`Mask of ${shortAddress(wallet.address)}`} />
      </motion.span>
      <span className="cast__addr lg-addr">{shortAddress(wallet.address, 3)}</span>
      <span className="cast__pair">
        {wallet.temperament.spot} / {wallet.temperament.perp}
      </span>
      <span className="cast__meter" aria-hidden="true">
        <span className="cast__meter-fill" style={{ width: `${wallet.duality}%` }} />
      </span>
    </button>
  );
}

/** The cast: a row of small masks, most two-faced first. */
export function WalletPicker({ wallets, selected, t, onSelect }: Props) {
  return (
    <Stagger className="cast" gap={0.05} role="tablist" aria-label="The cast">
      {wallets.map((w, i) => (
        <StaggerItem key={w.address} y={10} className="cast__item">
          <Seat wallet={w} selected={i === selected} t={t} onSelect={() => onSelect(i)} />
          {/* Beside the seat, never inside it: the seat is a button. */}
          <NansenLink address={w.address} className="cast__nansen" />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
