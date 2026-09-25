"use client";
import { social, useIdentity } from "@longitude/kit";
import { Reveal } from "@longitude/motion";
import { shortAddress } from "@longitude/nansen";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Animal, MenagerieData, Species, SpeciesId } from "@/lib/data";
import { type CollectedItem, NATURALIST_BOARD, SPECIMEN_LIST, article } from "@/lib/journal";
import { FieldNotes } from "./FieldNotes";
import { Legend } from "./Legend";
import { Savanna } from "./Savanna";
import { SpecimenIndex } from "./SpecimenIndex";

const longDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function Menagerie({ data }: { data: MenagerieData }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pinned, setPinned] = useState<SpeciesId | null>(null);
  const [preview, setPreview] = useState<SpeciesId | null>(null);
  const highlight = pinned ?? preview;

  const speciesById = useMemo(() => Object.fromEntries(data.species.map((s) => [s.id, s])) as Record<SpeciesId, Species>, [data.species]);
  const counts = useMemo(() => {
    const c = {} as Record<SpeciesId, number>;
    for (const s of data.species) c[s.id] = 0;
    for (const a of data.animals) c[a.species] = (c[a.species] ?? 0) + 1;
    return c;
  }, [data]);

  /* The field journal lives on the social layer. Every call is fail-safe: unreachable means an empty journal, nothing more. */
  const me = useIdentity();
  const [collected, setCollected] = useState<ReadonlyMap<string, CollectedItem>>(() => new Map());
  const [boardTick, setBoardTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void social.items(SPECIMEN_LIST).then((r) => {
      if (!alive || !r?.ok) return;
      const next = new Map<string, CollectedItem>();
      for (const it of r.items) {
        const sp = it.data.species;
        if (typeof sp !== "string" || !(sp in speciesById)) continue;
        next.set(it.id, {
          species: sp as SpeciesId,
          label: typeof it.data.label === "string" ? it.data.label : "",
          chain: typeof it.data.chain === "string" ? it.data.chain : "",
          addedAt: it.addedAt,
        });
      }
      setCollected(next);
    });
    return () => {
      alive = false;
    };
  }, [speciesById]);

  /** Logs a specimen. Resolves true once the journal has it; the score and the feed event fire only for a new entry. */
  const collect = useCallback(
    async (animal: Animal): Promise<boolean> => {
      if (collected.has(animal.address)) return true;
      const r = await social.addItem(SPECIMEN_LIST, animal.address, { species: animal.species, label: animal.label, chain: animal.chain });
      if (!r?.ok) return false;
      setCollected((m) => new Map(m).set(animal.address, { species: animal.species, label: animal.label, chain: animal.chain, addedAt: new Date().toISOString() }));
      const name = speciesById[animal.species].name;
      void social.event("collect", `${me?.handle ?? "A naturalist"} logged ${article(name)} ${name} (${shortAddress(animal.address)})`);
      void social.score(NATURALIST_BOARD, 1, "sum").then(() => setBoardTick((t) => t + 1));
      return true;
    },
    [collected, me, speciesById],
  );

  const inked = useMemo(() => {
    const s = new Set<SpeciesId>();
    for (const c of collected.values()) s.add(c.species);
    return s;
  }, [collected]);

  const animal = data.animals.find((a) => a.address === selected) ?? null;
  const seen = data.species.filter((s) => counts[s.id] > 0).length;
  const select = useCallback((address: string) => setSelected((cur) => (cur === address ? null : address)), []);
  const close = useCallback(() => setSelected(null), []);

  return (
    <div className="journal">
      <Reveal className="journal__kicker" y={8}>
        <p className="journal__date">
          Field season {longDate(data.window.from)} to {longDate(data.window.to)}
        </p>
        <h2 className="journal__title">Plate I. The savanna</h2>
        <p className="journal__lede">
          {data.herd.size} smart money wallets observed over thirty days, {seen} species. Sizes not to scale; behaviours are.
        </p>
      </Reveal>

      <div className="journal__plate">
        <Savanna
          animals={data.animals}
          speciesById={speciesById}
          selected={selected}
          highlight={highlight}
          collected={collected}
          caption="Tap an animal to open its field notes. Whales keep to the water hole, hummingbirds to the sky; the tortoise is moving, given time."
          onSelect={select}
        />
        <Legend
          species={data.species}
          counts={counts}
          highlight={highlight}
          pinned={pinned}
          inked={inked}
          specimens={collected.size}
          boardTick={boardTick}
          onPreview={setPreview}
          onPin={setPinned}
        />
      </div>

      <SpecimenIndex animals={data.animals} speciesById={speciesById} highlight={highlight} selected={selected} collected={collected} onSelect={select} />

      <FieldNotes
        animal={animal}
        species={animal ? speciesById[animal.species] : null}
        herd={data.herd}
        collected={animal ? (collected.get(animal.address) ?? null) : null}
        onCollect={collect}
        onClose={close}
      />
    </div>
  );
}
