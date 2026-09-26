"use client";
import { Leaderboard, caption, social, useIdentity } from "@longitude/kit";
import { Reveal, Stagger, StaggerItem, useMotionValue, useReducedMotion } from "@longitude/motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RewindData } from "@/lib/data";
import { claimAward, useScore } from "@/lib/score";
import { Cassette } from "./Cassette";
import { Playback } from "./Playback";
import { Readout } from "./Readout";
import { TapeWheel } from "./TapeWheel";
import { Transport } from "./Transport";
import { type Phase, pickColor, revealSeconds } from "./shared";

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

  // Meridian social layer. Every social.* call resolves null on failure, so the deck never waits on it.
  const me = useIdentity();
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  /** Bumped once the points have landed, so the board refetches after the write, not before. */
  const [boardTick, setBoardTick] = useState(0);

  // Recording captions (?rec=1). A wheel drag crosses several tapes; only the one it settles on is narrated.
  const tapeCaption = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(tapeCaption.current), []);

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(tapes.length - 1, i));
      if (next === index || phase === "playing") return;
      setIndex(next);
      setCall(null);
      setPhase("idle");
      const label = tapes[next]?.label;
      clearTimeout(tapeCaption.current);
      if (label) {
        tapeCaption.current = setTimeout(
          () => caption(`These are the tokens Nansen's historical screener showed smart money buying in the week up to ${label}.`),
          450,
        );
      }
    },
    [index, phase, tapes],
  );

  // PLAY: the paths draw (staggered per pick), then the verdict lands and the score is written.
  useEffect(() => {
    if (phase !== "playing" || !tape || !call) return;
    const t = setTimeout(
      () => {
        setPhase("revealed");
        const hit = call === tape.winner;
        const after = record(tape.date, call, hit);
        // Points and the feed line go out once per visitor per tape date; replays only touch localStorage.
        if (claimAward(tape.date)) {
          const handle = meRef.current?.handle ?? "Someone";
          void Promise.all([social.score("rewind", hit ? 1 : 0, "sum"), social.score("rewind-streak", after.streak, "max")]).then(() =>
            setBoardTick((n) => n + 1),
          );
          void social.event(
            "call",
            `${handle} called $${call} on ${tape.label}: ${hit ? "HIT" : "MISS"} (score ${after.hits}/${after.answered}, streak ${after.streak})`,
          );
        }
      },
      reduce ? 120 : revealSeconds(tape.picks.length) * 1000,
    );
    return () => clearTimeout(t);
  }, [phase, tape, call, reduce, record]);

  if (!tape) return <p className="lg-muted">This snapshot holds no tapes yet.</p>;

  const lock = () => {
    if (phase !== "idle" || !call) return;
    setPhase("locked");
    clearTimeout(tapeCaption.current);
    caption("Call locked. Each cassette now links to its token in Nansen. Press play to see the next 30 days.");
  };
  const play = () => {
    if (phase !== "locked") return;
    setPhase("playing");
    // Held long enough to stay up through the verdict.
    caption(`Each line is a pick's real daily price from Nansen over the 30 days after ${tape.label}.`, 7000);
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

  const hit = call !== null && call === tape.winner;
  const shareText =
    phase === "revealed" && call
      ? `I called $${call} on Rewind: ${hit ? "HIT" : "MISS"} (${summary.hits}/${summary.answered}, streak ${summary.streak}). Can you beat the tape? LONGITUDE, built on @nansen_ai`
      : null;

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
        <div className="deck__board">
          <Leaderboard board="rewind" title="Top callers" unit="hits" limit={5} refreshKey={`${summary.answered}:${boardTick}`} />
        </div>
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
        <Playback tape={tape} phase={phase} call={call} shareText={shareText} />
      </section>
    </div>
  );
}
