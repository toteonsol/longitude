"use client";
import { type MotionValue, Typewriter, fmt, motion, useTransform } from "@longitude/motion";
import { HOLD_DAYS, type Tape } from "@/lib/data";
import type { ScoreSummary } from "@/lib/score";
import type { Phase } from "./shared";

interface Props {
  tape: Tape;
  tapes: Tape[];
  index: number;
  phase: Phase;
  call: string | null;
  summary: ScoreSummary;
  ready: boolean;
  pos: MotionValue<number>;
  onReset: () => void;
}

/** The VFD window: tape counter, date, what to do next, running score. */
export function Readout({ tape, tapes, index, phase, call, summary, ready, pos, onReset }: Props) {
  const days = tapes.map((t) => t.daysAgo);
  // The counter interpolates between tapes while the wheel is mid-drag, like a real tape counter.
  const counter = useTransform(pos, (p) => {
    const last = days.length - 1;
    const v = Math.max(0, Math.min(last, p));
    const lo = Math.floor(v);
    const a = days[lo] ?? 0;
    const b = days[Math.min(last, lo + 1)] ?? a;
    return `T-${String(Math.round(a + (b - a) * (v - lo))).padStart(3, "0")}D`;
  });

  const winner = tape.picks.find((p) => p.symbol === tape.winner);
  const won = winner ? fmt.pctSigned(winner.returnPct30d, 0) : "";
  const hit = call !== null && call === tape.winner;
  const msg =
    phase === "playing"
      ? `▶ PLAYING · ${HOLD_DAYS} DAYS ROLLING`
      : phase === "revealed"
        ? hit
          ? `$${tape.winner} ${won} · YOU CALLED IT`
          : `$${tape.winner} ${won} WON · YOUR $${call ?? ""} MISSED`
        : phase === "locked"
          ? `LOCKED $${call ?? ""} · PRESS ▶ PLAY`
          : call
            ? `CALL $${call} · PRESS ● LOCK`
            : "SMART MONEY BOUGHT THESE THAT WEEK · PICK THE ONE THAT PAID";
  const tone = phase === "revealed" ? (hit ? "hit" : "miss") : phase === "locked" || call ? "lock" : "idle";

  return (
    <div className="readout">
      <div className="readout__row">
        <span className="readout__tape">
          TAPE {index + 1}/{tapes.length}
        </span>
        <motion.span className="readout__counter">{counter}</motion.span>
        <span className="readout__date">{tape.label.toUpperCase()}</span>
      </div>
      <Typewriter key={msg} text={msg} speed={14} as="p" className={`readout__msg readout__msg--${tone}`} />
      <span className="sr-only" aria-live="polite">
        {msg}
      </span>
      <div className="readout__score">
        <span>
          SCORE {ready ? `${summary.hits}/${summary.answered}` : "--/--"} · STREAK {ready ? summary.streak : "-"}
          {ready && summary.best > 1 ? ` · BEST ${summary.best}` : ""}
        </span>
        {ready && summary.answered > 0 ? (
          <button type="button" className="readout__reset" onClick={onReset}>
            CLEAR
          </button>
        ) : null}
      </div>
    </div>
  );
}
