"use client";
import { fmt } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { type CSSProperties, useMemo } from "react";
import type { Animal, Species, SpeciesId } from "@/lib/data";
import { planHerd } from "@/lib/roam";
import { Scene } from "./Scene";
import { Silhouette } from "./Silhouette";
import { Stamp } from "./Stamp";

interface Props {
  animals: Animal[];
  speciesById: Record<SpeciesId, Species>;
  selected: string | null;
  highlight: SpeciesId | null;
  /** Addresses logged in the visitor's journal. */
  collected: ReadonlyMap<string, unknown>;
  caption: string;
  onSelect: (address: string) => void;
}

/**
 * The plate. Each animal is a button positioned in percent of the stage and driven by a CSS keyframe
 * loop over its own waypoints (see globals.css `roam`), so the herd scales with the container,
 * pauses on hover, and stands still under prefers-reduced-motion without any per-frame JS.
 */
export function Savanna({ animals, speciesById, selected, highlight, collected, caption, onSelect }: Props) {
  const plans = useMemo(() => planHerd(animals), [animals]);

  return (
    <figure className="savanna">
      <div className={`savanna__stage${highlight ? " has-highlight" : ""}`}>
        <Scene />
        <div className="savanna__herd">
          {animals.map((a, i) => {
            const p = plans[i];
            if (!p) return null;
            const sp = speciesById[a.species];
            const open = selected === a.address;
            const lit = highlight === a.species;
            const dim = highlight !== null && !lit;
            const logged = collected.has(a.address);
            const style = {
              "--x0": `${p.x[0]}%`,
              "--x1": `${p.x[1]}%`,
              "--x2": `${p.x[2]}%`,
              "--x3": `${p.x[3]}%`,
              "--y0": `${p.y[0]}%`,
              "--y1": `${p.y[1]}%`,
              "--y2": `${p.y[2]}%`,
              "--y3": `${p.y[3]}%`,
              "--dur": `${p.dur}s`,
              "--delay": `${p.delay}s`,
              "--appear": `${0.15 + i * 0.04}s`,
              "--depth": p.scale,
              "--z": p.z,
              left: `${p.x[0]}%`,
              top: `${p.y[0]}%`,
            } as CSSProperties;
            const cls = [
              "animal",
              `animal--${a.species}`,
              `animal--${p.zone}`,
              open ? "is-open" : "",
              lit ? "is-lit" : "",
              dim ? "is-dim" : "",
              logged ? "is-collected" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={a.address}
                type="button"
                className={cls}
                style={style}
                onClick={() => onSelect(a.address)}
                aria-pressed={open}
                aria-label={`${sp.name}, ${shortAddress(a.address)}, ${fmt.usdSigned(a.stats.pnlUsd)} over 30 days${logged ? ", logged in your journal" : ""}. Open its field notes.`}
              >
                <span className="animal__anchor">
                  <span className="animal__shadow" />
                  <span className="animal__body">
                    <Silhouette species={a.species} />
                  </span>
                  {logged ? (
                    <span className="animal__stamp" aria-hidden="true">
                      <Stamp />
                    </span>
                  ) : null}
                  <span className="animal__tag" aria-hidden="true">
                    {sp.name} · {shortAddress(a.address, 3)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <figcaption className="savanna__caption">{caption}</figcaption>
    </figure>
  );
}
