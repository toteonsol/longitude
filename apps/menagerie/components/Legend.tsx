"use client";
import type { Species, SpeciesId } from "@/lib/data";
import { Silhouette } from "./Silhouette";

interface Props {
  species: Species[];
  counts: Record<SpeciesId, number>;
  highlight: SpeciesId | null;
  pinned: SpeciesId | null;
  onPreview: (id: SpeciesId | null) => void;
  onPin: (id: SpeciesId | null) => void;
}

/** The key to the plate. Hover previews a species; tap pins it (the mobile equivalent). */
export function Legend({ species, counts, highlight, pinned, onPreview, onPin }: Props) {
  return (
    <aside className="legend" aria-label="Species legend">
      <h2 className="legend__title">Species observed</h2>
      <p className="legend__hint">Hover or tap a species to pick it out of the herd.</p>
      <ul className="legend__list">
        {species.map((s) => {
          const n = counts[s.id];
          const on = highlight === s.id;
          const cls = ["legend__item", `legend__item--${s.id}`, on ? "is-on" : "", n === 0 ? "is-absent" : ""].filter(Boolean).join(" ");
          return (
            <li key={s.id}>
              <button
                type="button"
                className={cls}
                aria-pressed={pinned === s.id}
                onMouseEnter={() => onPreview(s.id)}
                onMouseLeave={() => onPreview(null)}
                onFocus={() => onPreview(s.id)}
                onBlur={() => onPreview(null)}
                onClick={() => onPin(pinned === s.id ? null : s.id)}
              >
                <span className="legend__sil">
                  <Silhouette species={s.id} />
                </span>
                <span className="legend__text">
                  <span className="legend__name">
                    {s.name} <small>{n === 0 ? "not seen" : `×${n}`}</small>
                  </span>
                  <span className="legend__latin">{s.latin}</span>
                  <span className="legend__more">
                    <span>
                      <span className="legend__rule">{s.rule}</span>
                      <span className="legend__cutoff">{s.cutoff}</span>
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
