"use client";
import type { Phase } from "./shared";

interface Props {
  phase: Phase;
  hasCall: boolean;
  canRew: boolean;
  canFf: boolean;
  onRew: () => void;
  onFf: () => void;
  onLock: () => void;
  onPlay: () => void;
  onStop: () => void;
}

/** Five chunky keys. REW and FF move between tapes; STOP resets the tape; LOCK then PLAY runs the reveal. */
export function Transport({ phase, hasCall, canRew, canFf, onRew, onFf, onLock, onPlay, onStop }: Props) {
  const busy = phase === "playing";
  return (
    <div className="transport" role="group" aria-label="Transport">
      <Key glyph="◀◀" label="Rew" title="Older tape" disabled={busy || !canRew} onClick={onRew} />
      <Key glyph="■" label="Stop" title="Stop and reset this tape" disabled={phase === "idle" && !hasCall} onClick={onStop} />
      <Key glyph="●" label="Lock" title="Lock your call" kind="lock" lit={phase !== "idle"} disabled={phase !== "idle" || !hasCall} onClick={onLock} />
      <Key glyph="▶" label="Play" title="Roll the 30 days" kind="play" lit={busy || phase === "revealed"} disabled={phase !== "locked"} onClick={onPlay} />
      <Key glyph="▶▶" label="FF" title="Newer tape" disabled={busy || !canFf} onClick={onFf} />
    </div>
  );
}

function Key({
  glyph,
  label,
  title,
  kind,
  lit,
  disabled,
  onClick,
}: {
  glyph: string;
  label: string;
  title: string;
  kind?: "lock" | "play";
  lit?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`key${kind ? ` key--${kind}` : ""}${lit ? " is-lit" : ""}`}
      title={title}
      aria-label={`${label}: ${title}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="key__led" aria-hidden="true" />
      <span className="key__glyph" aria-hidden="true">
        {glyph}
      </span>
      <span className="key__label">{label}</span>
    </button>
  );
}
