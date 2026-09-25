"use client";
import { ReactionBar, social, useIdentity } from "@longitude/kit";
import { AnimatePresence, motion, useAnimationFrame, useMotionValue } from "@longitude/motion";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AsTheChainTurnsData, CastMember, Scene } from "@/lib/data";
import { hhmm, longDate } from "@/lib/format";
import { MiniCast } from "./CastCard";
import { CastStrip } from "./CastStrip";
import { Rundown } from "./Rundown";
import { EndCard, PreviouslyCard, SceneStage, TitleCard } from "./Screen";

type Cue =
  | { kind: "title"; ms: number }
  | { kind: "previously"; ms: number }
  | { kind: "scene"; ms: number; scene: Scene }
  | { kind: "end"; ms: number };

const TITLE_MS = 5200;
/** About five seconds a scene, a little longer when the caption has more to say. */
const sceneMs = (s: Scene) => Math.min(8000, Math.max(5000, 1500 + s.caption.length * 27 + 1800));

const Icon = {
  prev: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5h2v14H6zM20 5v14L9 12z" />
    </svg>
  ),
  next: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4v16l14-8z" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  ),
};

function cueLabel(c: Cue, total: number): string {
  if (c.kind === "title") return "Opening titles";
  if (c.kind === "previously") return "Previously on…";
  if (c.kind === "end") return "To be continued";
  return `Scene ${c.scene.index} of ${total} · ${c.scene.title}`;
}

/**
 * The episode player. A cue list (title → previously → scenes → end) advanced by a frame clock that
 * only runs while playing; the progress bar is a motion value so the clock never re-renders React.
 */
export function EpisodePlayer({ data }: { data: AsTheChainTurnsData }) {
  const { episode, cast, scenes } = data;
  const cues = useMemo<Cue[]>(
    () => [
      { kind: "title", ms: TITLE_MS },
      { kind: "previously", ms: 1400 + episode.previously.length * 1500 + 1500 },
      ...scenes.map((scene) => ({ kind: "scene" as const, ms: sceneMs(scene), scene })),
      { kind: "end", ms: Number.POSITIVE_INFINITY },
    ],
    [episode.previously.length, scenes],
  );
  const castByAddress = useMemo(() => new Map(cast.map((m) => [m.address, m])), [cast]);
  const sceneCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of scenes) counts.set(s.wallet, (counts.get(s.wallet) ?? 0) + 1);
    return counts;
  }, [scenes]);
  const firstScene = 2;
  const last = cues.length - 1;

  const [cue, setCue] = useState(0);
  const [playing, setPlaying] = useState(true);
  const progress = useMotionValue(0);
  const elapsed = useRef(0);
  const cueRef = useRef(0);
  const playingRef = useRef(true);
  useEffect(() => {
    cueRef.current = cue;
  }, [cue]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const go = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(last, next));
      elapsed.current = 0;
      progress.set(0);
      cueRef.current = target;
      setCue(target);
      if (target === last) {
        playingRef.current = false;
        setPlaying(false);
      }
    },
    [last, progress],
  );

  const play = useCallback(() => {
    playingRef.current = true;
    setPlaying(true);
  }, []);

  const tick = useCallback(
    (_: number, delta: number) => {
      if (!playingRef.current) return;
      const current = cues[cueRef.current];
      if (!current || !Number.isFinite(current.ms)) return;
      elapsed.current += Math.min(delta, 100); // a tab coming back from the background must not skip scenes
      progress.set(Math.min(1, elapsed.current / current.ms));
      if (elapsed.current >= current.ms) go(cueRef.current + 1);
    },
    [cues, go, progress],
  );
  useAnimationFrame(tick);

  const toggle = () => {
    if (cue === last) {
      go(0);
      play();
      return;
    }
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
    } else play();
  };
  const replay = () => {
    go(0);
    play();
  };
  const jumpToScene = (index: number) => go(firstScene + index - 1);
  const jumpToMember = (m: CastMember) => {
    const mine = scenes.filter((s) => s.wallet === m.address);
    if (!mine.length) return;
    const after = mine.find((s) => firstScene + s.index - 1 > cue);
    const target = after ?? mine[0];
    if (target) jumpToScene(target.index);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const onButton = (e.target as HTMLElement).tagName === "BUTTON";
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(cue + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(cue - 1);
    } else if ((e.key === " " || e.key === "k") && !onButton) {
      e.preventDefault();
      toggle();
    }
  };

  const current = cues[cue] ?? cues[0];
  const activeScene = current?.kind === "scene" ? current.scene : undefined;
  const actor = activeScene ? castByAddress.get(activeScene.wallet) : undefined;
  const coStar = activeScene?.coStar ? castByAddress.get(activeScene.coStar) : undefined;
  const intro = current?.kind === "title" || current?.kind === "previously";

  return (
    <div className="player" onKeyDown={onKey}>
      <div className="tv" role="region" aria-label="Episode player">
        <div className="tv__bezel">
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the screen takes keyboard focus for space/arrow control */}
          <div className="tv__screen" tabIndex={0} aria-label="Screen. Space plays or pauses, arrow keys change scenes.">
            <AnimatePresence>
              {current?.kind === "title" ? <TitleCard key="title" episode={episode} /> : null}
              {current?.kind === "previously" ? <PreviouslyCard key="previously" episode={episode} castByAddress={castByAddress} /> : null}
              {current?.kind === "scene" && actor ? (
                <SceneStage key={`scene-${current.scene.index}`} scene={current.scene} actor={actor} coStar={coStar} total={scenes.length} />
              ) : null}
              {current?.kind === "end" ? <EndCard key="end" data={data} onReplay={replay} /> : null}
            </AnimatePresence>
            <MiniCast cast={cast} activeAddress={actor?.address} visible={current?.kind === "scene"} onPick={jumpToMember} />
            {intro && scenes.length ? (
              <button type="button" className="tv__skip" onClick={() => go(firstScene)}>
                Skip intro
              </button>
            ) : null}
            {!playing && current?.kind !== "end" ? (
              <div className="tv__paused" aria-hidden="true">
                ❚❚ PAUSE
              </div>
            ) : null}
            <div className="tv__glass" aria-hidden="true" />
          </div>
        </div>
        <div className="tv__plaque" aria-hidden="true">
          <span>LONGITUDE</span>
          <span>CH 4110</span>
        </div>
      </div>

      <div className="player__controls">
        <div className="player__buttons">
          <button type="button" className="player__btn" onClick={() => go(cue - 1)} disabled={cue === 0} aria-label="Previous">
            {Icon.prev}
          </button>
          <button type="button" className="player__btn player__play" onClick={toggle} aria-label={playing ? "Pause" : cue === last ? "Replay" : "Play"}>
            {playing ? Icon.pause : Icon.play}
          </button>
          <button type="button" className="player__btn" onClick={() => go(cue + 1)} disabled={cue === last} aria-label="Next">
            {Icon.next}
          </button>
        </div>
        <div className="player__track" role="group" aria-label="Episode progress">
          {cues.map((c, i) => (
            <button
              key={c.kind === "scene" ? c.scene.txHash || `scene-${c.scene.index}` : c.kind}
              type="button"
              className={`player__seg player__seg--${c.kind}${i === cue ? " is-current" : ""}${i < cue ? " is-done" : ""}`}
              onClick={() => go(i)}
              aria-label={cueLabel(c, scenes.length)}
              title={cueLabel(c, scenes.length)}
            >
              {i === cue ? <motion.span className="player__fill" style={{ scaleX: progress }} /> : null}
            </button>
          ))}
        </div>
        <p className="player__status">
          <span>{current ? cueLabel(current, scenes.length) : ""}</span>
          <span className="lg-mono">{activeScene ? `${hhmm(activeScene.at)} UTC` : playing ? "playing" : "paused"}</span>
        </p>
      </div>

      <p className="player__air">
        Episode {episode.number} · aired {longDate(episode.airDate)} · {scenes.length} scenes · {cast.length} wallets
      </p>
      <p className="player__synopsis">{episode.synopsis}</p>

      <CastStrip cast={cast} activeAddress={actor?.address} sceneCounts={sceneCounts} onPick={jumpToMember} />
      <Rundown scenes={scenes} cast={cast} currentIndex={activeScene?.index} onPick={jumpToScene} />
    </div>
  );
}
