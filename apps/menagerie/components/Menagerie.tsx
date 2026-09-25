"use client";
import { Reveal } from "@longitude/motion";
import { useCallback, useMemo, useState } from "react";
import type { MenagerieData, Species, SpeciesId } from "@/lib/data";
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
          caption="Tap an animal to open its field notes. Whales keep to the water hole, hummingbirds to the sky; the tortoise is moving, given time."
          onSelect={select}
        />
        <Legend species={data.species} counts={counts} highlight={highlight} pinned={pinned} onPreview={setPreview} onPin={setPinned} />
      </div>

      <SpecimenIndex animals={data.animals} speciesById={speciesById} highlight={highlight} selected={selected} onSelect={select} />

      <FieldNotes animal={animal} species={animal ? speciesById[animal.species] : null} herd={data.herd} onClose={close} />
    </div>
  );
}
