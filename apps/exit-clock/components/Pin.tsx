"use client";

/** A brass pin head on a stem: hollow when idle, filled when the hand is watched. Inherits color. */
export function Pin({ on, className }: { on: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 16" width="12" height="16" aria-hidden="true" focusable="false">
      <path d="M6 15.5 L6 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="6" cy="5" r="4" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" />
      {on ? <circle cx="6" cy="5" r="1.3" fill="#2a2a28" /> : null}
    </svg>
  );
}
