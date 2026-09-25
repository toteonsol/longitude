"use client";
import { Stagger, StaggerItem, fmt } from "@longitude/motion";
import type { Building } from "@/lib/data";
import type { BuildingPlan } from "@/lib/windows";

export interface SkylineItem {
  key: string;
  building: Building;
  plan: BuildingPlan;
}

interface Props {
  items: SkylineItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

const CELLS = 12;

/** Twelve tiny windows: still on, went dark, never lit. */
function Meter({ plan }: { plan: BuildingPlan }) {
  const on = Math.round((plan.stillOn / plan.count) * CELLS);
  const dusk = Math.round((plan.litCount / plan.count) * CELLS);
  return (
    <span className="row__meter" role="img" aria-label={`${plan.stillOn} of ${plan.count} windows still on`}>
      {Array.from({ length: CELLS }, (_, i) => (
        <i key={i} className={i < on ? "is-on" : i < dusk ? "is-out" : undefined} />
      ))}
    </span>
  );
}

/** The register under the skyline. Works on its own at phone width, where the skyline pans. */
export function Ledger({ items, selectedKey, onSelect }: Props) {
  return (
    <section className="ledger" aria-label="Buildings, by size of the smart money exit">
      <header className="ledger__head">
        <h2 className="ledger__title">The register</h2>
        <p className="ledger__sub">Twelve buildings, sorted by the size of the smart money exit. Tap a row to find its building.</p>
      </header>
      <Stagger className="ledger__list" gap={0.04} inView>
        {items.map(({ key, building: b, plan }) => (
          <StaggerItem key={key} y={10}>
            <button type="button" className={`row${selectedKey === key ? " is-on" : ""}`} onClick={() => onSelect(key)}>
              <span className="row__token">
                <small className="row__rank">{String(b.rank).padStart(2, "0")}</small>
                <b>${b.symbol}</b>
                <small>{b.chain}</small>
              </span>
              <Meter plan={plan} />
              <span className="row__num row__num--smart">
                <small>smart · 7d</small>
                {fmt.usdSigned(b.smartNetFlow7dUsd)}
              </span>
              <span className="row__num row__num--retail">
                <small>retail · 7d</small>
                {fmt.usdSigned(b.retailNetFlow7dUsd)}
              </span>
              <span className={`row__num row__num--px ${b.priceChange24hPct < 0 ? "is-down" : "is-up"}`}>
                <small>24h</small>
                {fmt.pctSigned(b.priceChange24hPct)}
              </span>
              <span className="row__caption">{b.caption}</span>
            </button>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
