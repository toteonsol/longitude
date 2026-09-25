"use client";
import { fmt } from "@longitude/motion";
import { type CSSProperties, memo } from "react";
import type { Building as BuildingData } from "@/lib/data";
import { type BuildingPlan, type WindowPlan, buildingKey } from "@/lib/windows";

function windowClass(w: WindowPlan): string {
  let c = `win win--${w.tint}`;
  if (w.lit) c += " is-lit";
  if (w.off) c += " win--off";
  if (w.flicker) c += " win--flicker";
  if (w.breathe) c += " win--breathe";
  return c;
}

/** The window grid. Every window is one <i>; its blackout delay rides on a CSS variable. */
function Facade({ plan }: { plan: BuildingPlan }) {
  return (
    <span className="bld__grid" style={{ gridTemplateColumns: `repeat(${plan.cols}, var(--win-w))` }}>
      {plan.windows.map((w, i) => (
        <i key={i} className={windowClass(w)} style={w.off || w.breathe ? ({ "--d": `${w.delay}s` } as CSSProperties) : undefined} />
      ))}
    </span>
  );
}

interface Props {
  building: BuildingData;
  plan: BuildingPlan;
  index: number;
  active: boolean;
  /** The water reflection: same facade, no interaction, no label. */
  mirror?: boolean;
  onHover?: (key: string | null) => void;
  onTap?: (key: string) => void;
}

export const Building = memo(function Building({ building: b, plan, index, active, mirror = false, onHover, onTap }: Props) {
  const key = buildingKey(b);
  const style = { "--i": index, "--w": `${plan.width}px`, "--h": `${plan.height}px`, "--tone": plan.tone } as CSSProperties;
  const roof = <span className={`bld__roof bld__roof--${plan.roof}`} aria-hidden="true" />;

  if (mirror) {
    return (
      <div className={`bld bld--mirror${active ? " is-active" : ""}`} style={style} aria-hidden="true">
        {roof}
        <span className="bld__body">
          <Facade plan={plan} />
        </span>
      </div>
    );
  }

  const label =
    `${b.symbol} on ${b.chain}, exit number ${b.rank}. Smart money ${fmt.usdSigned(b.smartNetFlow7dUsd)} over 7 days, ` +
    `retail ${fmt.usdSigned(b.retailNetFlow7dUsd)}. ${plan.stillOn} of ${plan.count} windows still on.`;

  return (
    <div className={`bld${active ? " is-active" : ""}`} style={style} data-bld={key}>
      {roof}
      <button
        type="button"
        className="bld__body"
        aria-label={label}
        aria-pressed={active}
        onPointerEnter={() => onHover?.(key)}
        onPointerLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(key)}
        onBlur={() => onHover?.(null)}
        onClick={() => onTap?.(key)}
      >
        <Facade plan={plan} />
      </button>
      <span className="bld__label">{b.symbol}</span>
    </div>
  );
});
