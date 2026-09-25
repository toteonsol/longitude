"use client";
import { ShareButton } from "@longitude/kit";
import { NumberTicker, Reveal, fmt } from "@longitude/motion";
import type { LastOnesOutData } from "@/lib/data";
import { shareText } from "@/lib/share";

/** Four numbers for the whole city, above the skyline, and the line to share. */
export function NightReport({ data }: { data: LastOnesOutData }) {
  const n = data.buildings.length;
  return (
    <Reveal className="report" spring="snappy">
      <div className="report__tile report__tile--smart">
        <b>
          <NumberTicker value={-data.totals.smartExitUsd} format={fmt.usdSigned} />
        </b>
        <span>smart money out · 7d</span>
      </div>
      <div className="report__tile report__tile--retail">
        <b>
          <NumberTicker value={data.totals.retailInflowUsd} format={fmt.usdSigned} />
        </b>
        <span>retail still buying · 7d</span>
      </div>
      <div className="report__tile">
        <b>
          <NumberTicker value={data.totals.stillLit} format={(v) => `${Math.round(v)} / ${n}`} duration={1.6} />
        </b>
        <span>buildings still lit</span>
      </div>
      <div className="report__tile report__tile--when">
        <b>
          {data.window.from} → {data.window.to}
        </b>
        <span>{data.chains.join(" · ")}</span>
      </div>
      <div className="report__share">
        <ShareButton text={shareText(data)} />
        <span className="report__sharecap">tonight's skyline</span>
      </div>
    </Reveal>
  );
}
