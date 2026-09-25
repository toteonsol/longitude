"use client";
import { Reveal, Stagger, StaggerItem, useMotionValue, useReducedMotion } from "@longitude/motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RewindData } from "@/lib/data";
import { useScore } from "@/lib/score";
import { Cassette } from "./Cassette";
import { Playback } from "./Playback";
import { Readout } from "./Readout";
import { TapeWheel } from "./TapeWheel";
import { Transport } from "./Transport";
import { PLAY_SECONDS, type Phase, pickColor } from "./shared";

/** The deck: tape wheel → cassette → LOCK → PLAY → verdict. One phase machine; everything else reads it. */
export function Deck({ data }: { data: RewindData }) {
  const tapes = data.tapes;
  const [index, setIndex] = useState(0);
  const [call, setCall] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const reduce = useReducedMotion();
  /** Fractional tape position: the wheel writes it, the reels and the counter read it without re-rendering. */
  const pos = useMotionValue(0);
  const { summary, ready, record, reset } = useScore();
  const tvRef = useRef<HTMLElement>(null);
  const tape = tapes[Math.min(index, Math.max(0, tapes.length - 1))];

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(tapes.length - 1, i));
      if (next === index || phase === "playing") return;
      setIndex(next);
      setCall(null);
      setPhase("idle");
    },
    [index, phase, tapes.length],
  );

  // PLAY: the paths draw for PLAY_SECONDS, then the verdict lands and the score is written.
  useEffect(() => {
    if (phase !== "playing" || !tape || !call) return;
    const t = setTimeout(
      () => {
        setPhase("revealed");
        record(tape.date, call, call === tape.winner);
      },
      reduce ? 120 : PLAY_SECONDS * 1000,
    );
    return () => clearTimeout(t);
  }, [phase, tape, call, reduce, record]);

  if (!tape) return <p className="lg-muted">This snapshot holds no tapes yet.</p>;

  const lock = () => {
    if (phase === "idle" && call) setPhase("locked");
  };
  const play = () => {
    if (phase !== "locked") return;
    setPhase("playing");
    // Single-column layouts: bring the screen up so the reveal is on screen when it starts.
    if (window.matchMedia("(max-width: 960px)").matches) tvRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const stop = () => {
    setPhase("idle");
    setCall(null);
  };
  const select = (symbol: string) => {
    if (phase === "idle") setCall((c) => (c === symbol ? null : symbol));
  };
  const hitFor = (symbol: string): boolean | null => (phase === "revealed" && call === symbol ? symbol === tape.winner : null);

  return (
    <div className="rewind" data-phase={phase}>
      <div className="vhs-scan" aria-hidden="true" />
      <div className="vhs-track" aria-hidden="true" />
      <Reveal className="deck" spring="snappy" y={18} role="region" aria-label="VHS deck">
        <div className="deck__plate">
          <span>Longitude</span>
          <span>VHS-4108 · Hi-Fi · {tapes.length} tapes</span>
          <span className="deck__led" aria-hidden="true" />
        </div>
        <TapeWheel tapes={tapes} index={index} phase={phase} pos={pos} onIndex={goTo} />
        <Readout tape={tape} tapes={tapes} index={index} phase={phase} call={call} summary={summary} ready={ready} pos={pos} onReset={reset} />
        <Stagger key={tape.date} className="rack" gap={0.05}>
          {tape.picks.map((p, i) => (
            <StaggerItem key={`${p.chain}:${p.address}`} y={10}>
              <Cassette
                pick={p}
                color={pickColor(i)}
                phase={phase}
                selected={call === p.symbol}
                isWinner={p.symbol === tape.winner}
                hit={hitFor(p.symbol)}
                onSelect={() => select(p.symbol)}
              />
            </StaggerItem>
          ))}
        </Stagger>
        <Transport
          phase={phase}
          hasCall={call !== null}
          canRew={index < tapes.length - 1}
          canFf={index > 0}
          onRew={() => goTo(index + 1)}
          onFf={() => goTo(index - 1)}
          onLock={lock}
          onPlay={play}
          onStop={stop}
        />
        <div className="deck__vents" aria-hidden="true" />
      </Reveal>
      <section className="tv" ref={tvRef} aria-label="Playback">
        <Playback tape={tape} phase={phase} call={call} />
      </section>
    </div>
  );
}
