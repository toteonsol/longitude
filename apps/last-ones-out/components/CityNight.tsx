"use client";
import { type MouseEvent, useCallback, useMemo, useRef, useState } from "react";
import type { LastOnesOutData } from "@/lib/data";
import { buildingKey, planBuilding } from "@/lib/windows";
import { Building } from "./Building";
import { BuildingPanel } from "./BuildingPanel";
import { Ledger, type SkylineItem } from "./Ledger";
import { NightReport } from "./NightReport";
import { FarSkyline, Sky } from "./Sky";

/**
 * The world: a night report, the skyline (stars, moon, buildings, water), the numbers panel, the register.
 * Hover previews a building, tap pins it; the skyline background clears the pin. "Replay" re-runs the blackout.
 */
export function CityNight({ data }: { data: LastOnesOutData }) {
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [take, setTake] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const items = useMemo<SkylineItem[]>(
    () => data.buildings.map((b, i) => ({ key: buildingKey(b), building: b, plan: planBuilding(b, i) })),
    [data.buildings],
  );
  const shownKey = hover ?? pinned;
  const shown = shownKey ? (items.find((it) => it.key === shownKey) ?? null) : null;

  const onHover = useCallback((key: string | null) => setHover(key), []);
  const onTap = useCallback((key: string) => setPinned((p) => (p === key ? null : key)), []);
  const onSelect = useCallback((key: string) => {
    setPinned(key);
    scrollerRef.current?.querySelector<HTMLElement>(`[data-bld="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, []);
  const clearPin = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest(".bld__body")) setPinned(null);
  };

  return (
    <div className="city">
      <NightReport data={data} />

      <section className="skyline" aria-label="This week's smart money exits, as a skyline">
        <Sky />
        <div className="skyline__bar">
          <span className="skyline__kicker">Tonight · tallest = biggest smart money exit</span>
          <span className="skyline__hint">swipe to pan</span>
          <button type="button" className="lg-btn lg-btn--ghost skyline__replay" onClick={() => setTake((t) => t + 1)}>
            Replay the blackout
          </button>
        </div>

        <div className="skyline__scroller" ref={scrollerRef} onClick={clearPin}>
          <div className="skyline__track" key={take}>
            <div className="skyline__row">
              <FarSkyline />
              {items.map((it, i) => (
                <Building key={it.key} building={it.building} plan={it.plan} index={i} active={it.key === shownKey} onHover={onHover} onTap={onTap} />
              ))}
            </div>
            <div className="skyline__street" aria-hidden="true" />
            <div className="skyline__water" aria-hidden="true">
              <div className="skyline__row skyline__row--mirror">
                {items.map((it, i) => (
                  <Building key={it.key} building={it.building} plan={it.plan} index={i} active={it.key === shownKey} mirror />
                ))}
              </div>
              <div className="skyline__ripple" />
            </div>
          </div>
        </div>

        <BuildingPanel building={shown?.building ?? null} plan={shown?.plan ?? null} pinned={pinned !== null && shownKey === pinned} onClose={() => setPinned(null)} />
      </section>

      <Ledger items={items} selectedKey={shownKey} onSelect={onSelect} />
    </div>
  );
}
