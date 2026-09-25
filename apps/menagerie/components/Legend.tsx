"use client";
import { Leaderboard, ShareButton } from "@longitude/kit";
import type { Species, SpeciesId } from "@/lib/data";
import { NATURALIST_BOARD } from "@/lib/journal";
import { Silhouette } from "./Silhouette";
import { Stamp } from "./Stamp";

interface Props {
  species: Species[];
  counts: Record<SpeciesId, number>;
  highlight: SpeciesId | null;
  pinned: SpeciesId | null;
  /** Species with at least one specimen in the visitor's journal. */
  inked: ReadonlySet<SpeciesId>;
  /** Specimens in the journal. */
  specimens: number;
  /** Bumps when the naturalists' board should refetch. */
  boardTick: number;
  onPreview: (id: SpeciesId | null) => void;
  onPin: (id: SpeciesId | null) => void;
}

/** The key to the plate, and the visitor's own field journal beneath it. Hover previews a species; tap pins it. */
export function Legend({ species, counts, highlight, pinned, inked, specimens, boardTick, onPreview, onPin }: Props) {
  const shareText = `I've collected ${inked.size}/${species.length} species of smart money in the MENAGERIE. LONGITUDE, built on @nansen_ai`;
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
                onClick={() => {
                  // A tap fires mouseenter before click, so unpinning must also drop the preview.
                  const next = pinned === s.id ? null : s.id;
                  onPin(next);
                  if (!next) onPreview(null);
                }}
              >
                <span className="legend__sil">
                  <Silhouette species={s.id} />
                </span>
                <span className="legend__text">
                  <span className="legend__name">
                    {s.name} <small>{n === 0 ? "not seen" : `×${n}`}</small>
                    {inked.has(s.id) ? <Stamp className="legend__seal" label="in your journal" /> : null}
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

      <section className="legend__journal" aria-labelledby="journal-title">
        <h3 id="journal-title" className="legend__jtitle">
          Your field journal
        </h3>
        <p className="legend__jline">
          {inked.size}/{species.length} species · {specimens} {specimens === 1 ? "specimen" : "specimens"}
        </p>
        <ul className="legend__strip" aria-label="Species inked into your journal">
          {species.map((s) => {
            const done = inked.has(s.id);
            return (
              <li key={s.id} className={`legend__mark legend__mark--${s.id}${done ? " is-inked" : ""}`} title={`${s.name} · ${done ? "inked in" : "not yet logged"}`}>
                <Silhouette species={s.id} title={`${s.name}, ${done ? "inked in" : "not yet logged"}`} />
              </li>
            );
          })}
        </ul>
        <p className="legend__jhint">Open an animal's field notes and log it to ink its species in.</p>
        <Leaderboard board={NATURALIST_BOARD} title="Top naturalists" unit="specimens" limit={7} refreshKey={boardTick} />
        <ShareButton text={shareText} label="Share your journal" />
      </section>
    </aside>
  );
}
