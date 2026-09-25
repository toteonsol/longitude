"use client";

/** A gold rule with a gem at its centre, or a label set into it. */
export function Rule({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={`rule${className ? ` ${className}` : ""}`} role="presentation">
      <span className="rule__line" />
      <span className="rule__gem">{label ? label : "❖"}</span>
      <span className="rule__line" />
    </div>
  );
}

/** A small coronet set above a patriarch's crest. */
export function Coronet({ className }: { className?: string }) {
  return (
    <svg className={`coronet${className ? ` ${className}` : ""}`} viewBox="0 0 64 28" width="64" height="28" aria-hidden="true">
      <path d="M6 24 L6 10 L18 17 L32 4 L46 17 L58 10 L58 24 Z" fill="currentColor" opacity="0.92" />
      <rect x="6" y="22" width="52" height="4" fill="currentColor" />
      <circle cx="6" cy="9" r="2.4" fill="currentColor" />
      <circle cx="32" cy="3.2" r="2.6" fill="currentColor" />
      <circle cx="58" cy="9" r="2.4" fill="currentColor" />
      <circle cx="19" cy="20" r="1.6" fill="#0d1b3d" />
      <circle cx="32" cy="18" r="1.8" fill="#0d1b3d" />
      <circle cx="45" cy="20" r="1.6" fill="#0d1b3d" />
    </svg>
  );
}
