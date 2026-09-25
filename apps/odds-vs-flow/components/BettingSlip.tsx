"use client";
import { Grow, fmt } from "@longitude/motion";
import type { Bout } from "@/lib/data";

/** FNV-1a, enough to make serials and barcodes stable per market. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function serialOf(id: string): string {
  const a = hash(`slip:${id}`) % 1_000_000;
  const b = hash(`check:${id}`) % 100;
  return `${String(a).padStart(6, "0")}-${String(b).padStart(2, "0")}`;
}

/** A Code-39-looking strip of bars drawn from the market id. */
function barcodeOf(id: string): { image: string; width: number } {
  let h = hash(`bars:${id}`);
  const stops: string[] = [];
  let x = 0;
  for (let i = 0; i < 44; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const bar = 1 + (h % 3);
    const gap = 1 + ((h >>> 8) % 3);
    stops.push(`var(--ink) ${x}px ${x + bar}px`, `transparent ${x + bar}px ${x + bar + gap}px`);
    x += bar + gap;
  }
  return { image: `linear-gradient(90deg, ${stops.join(", ")})`, width: x };
}

function closes(iso: string): string {
  if (!iso) return "open-ended";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${day} · ${time} UTC`;
}

const STAMP: Record<Bout["crowd"]["stance"], string> = {
  bullish: "Crowd says up",
  bearish: "Crowd says down",
  split: "Coin flip",
};

/** A Polymarket ticket: stub, tear line, prices, the small print, a barcode, a rubber stamp. */
export function BettingSlip({ bout: b }: { bout: Bout }) {
  const m = b.market;
  const yes = m.yesPct;
  const no = 100 - yes;
  const bars = barcodeOf(m.id);
  const spread = m.bidCents !== null && m.askCents !== null ? `${m.bidCents}¢ / ${m.askCents}¢` : "—";

  return (
    <div className={`slip slip--${b.crowd.stance}`}>
      <div className="slip__stub">
        <span className="slip__brand">Odds vs Flow · Polymarket</span>
        <span className="slip__bout">Bout {String(b.number).padStart(2, "0")}</span>
        <span className="slip__serial">Nº {serialOf(m.id)}</span>
        <span className="slip__keep">Keep this portion · market #{m.id}</span>
      </div>
      <div className="slip__tear" aria-hidden="true" />
      <div className="slip__body">
        <p className="slip__question">{m.question}</p>

        <div className="slip__odds" role="group" aria-label="Prices">
          <div className="slip__odd slip__odd--yes">
            <small>Yes</small>
            <b>{yes}¢</b>
          </div>
          <div className="slip__odd slip__odd--no">
            <small>No</small>
            <b>{no}¢</b>
          </div>
        </div>

        <div className="slip__meter" role="img" aria-label={`${yes}% implied probability of yes`}>
          <Grow percent={yes} className="slip__meterfill" spring="gentle" delay={0.25} />
          <span className="slip__meterline" aria-hidden="true" />
        </div>

        <dl className="slip__lines">
          <div>
            <dt>Implied</dt>
            <dd>{yes}% yes</dd>
          </div>
          <div>
            <dt>Bid / ask</dt>
            <dd>{spread}</dd>
          </div>
          <div>
            <dt>Volume</dt>
            <dd>{fmt.usd(m.volumeUsd)}</dd>
          </div>
          <div>
            <dt>Last 24h</dt>
            <dd>
              {fmt.usd(m.volume24hUsd)} · {fmt.int(m.traders24h)} bettors
            </dd>
          </div>
          <div>
            <dt>Liquidity</dt>
            <dd>{fmt.usd(m.liquidityUsd)}</dd>
          </div>
          <div>
            <dt>Closes</dt>
            <dd>{closes(m.endsAt)}</dd>
          </div>
        </dl>

        <div className="slip__foot">
          <span className="stamp stamp--slip">{STAMP[b.crowd.stance]}</span>
          <div className="slip__barcode" style={{ backgroundImage: bars.image, backgroundSize: `${bars.width}px 100%` }} aria-hidden="true" />
          <span className="slip__fine">
            Prices are the crowd's implied probability of YES. Conviction {b.crowd.conviction.toFixed(2)} = |{yes} − 50| / 50. Not advice.
          </span>
        </div>
      </div>
    </div>
  );
}
