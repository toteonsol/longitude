"use client";
import { Stagger, StaggerItem, fmt } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import type { Animal, Species, SpeciesId } from "@/lib/data";
import { Silhouette } from "./Silhouette";

interface Props {
  animals: Animal[];
  speciesById: Record<SpeciesId, Species>;
  highlight: SpeciesId | null;
  selected: string | null;
  /** Addresses logged in the visitor's journal. */
  collected: ReadonlyMap<string, unknown>;
  onSelect: (address: string) => void;
}

const PLURAL: Record<SpeciesId, string> = {
  whale: "whales",
  fox: "foxes",
  hummingbird: "hummingbirds",
  tortoise: "tortoises",
  hyena: "hyenas",
  elephant: "elephants",
  meerkat: "meerkats",
};

/** The catalogue under the plate: every specimen, filed in order, and a second way to reach the notes. */
export function SpecimenIndex({ animals, speciesById, highlight, selected, collected, onSelect }: Props) {
  const shown = highlight ? animals.filter((a) => a.species === highlight) : animals;
  const sub = highlight
    ? `${shown.length} ${shown.length === 1 ? speciesById[highlight].name.toLowerCase() : PLURAL[highlight]} on the plate · tap the legend again to see the whole herd`
    : `${animals.length} specimens, numbered in the order they were filed`;

  return (
    <section className="index" aria-labelledby="index-title">
      <div className="index__head">
        <h2 id="index-title" className="index__title">
          Specimen index
        </h2>
        <p className="index__sub">{sub}</p>
      </div>
      <Stagger key={highlight ?? "all"} className="index__grid" gap={0.04} inView>
        {shown.map((a) => {
          const sp = speciesById[a.species];
          const open = selected === a.address;
          const logged = collected.has(a.address);
          return (
            <StaggerItem key={a.address} y={10}>
              <button
                type="button"
                className={`specimen specimen--${a.species}${open ? " is-open" : ""}${logged ? " is-collected" : ""}`}
                onClick={() => onSelect(a.address)}
                aria-pressed={open}
              >
                <span className="specimen__no">No. {String(a.number).padStart(2, "0")}</span>
                {logged ? <span className="specimen__logged">Logged</span> : null}
                <span className="specimen__sil">
                  <Silhouette species={a.species} />
                </span>
                <span className="specimen__name">{sp.name}</span>
                <span className="specimen__addr lg-addr" title={a.address}>
                  {shortAddress(a.address, 4)}
                </span>
                <span className="specimen__stats">
                  <b>{fmt.usdSigned(a.stats.pnlUsd)}</b>
                  <span>
                    {a.stats.winRate.toFixed(0)}% win · {fmt.int(a.stats.trades)} trades
                  </span>
                </span>
              </button>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
