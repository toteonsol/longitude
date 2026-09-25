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

/** A swallow-tailed pennant, one per sworn follower. Fills with currentColor. */
export function Pennant({ className }: { className?: string }) {
  return (
    <svg className={`pennant${className ? ` ${className}` : ""}`} viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
      <path d="M0 0 H10 V16 L5 12 L0 16 Z" fill="currentColor" />
    </svg>
  );
}

/** A laurel wreath for the realm's favourite house. Strokes and leaves in currentColor. */
export function Laurel({ className }: { className?: string }) {
  const leaves = [
    [4.2, 3.4, -55],
    [3.2, 7.2, -78],
    [4.6, 10.8, -100],
    [7.6, 13.4, -125],
  ] as const;
  return (
    <svg className={`laurel${className ? ` ${className}` : ""}`} viewBox="0 0 28 16" width="28" height="16" aria-hidden="true">
      <path d="M5 1 C3 6 5 12 12 15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M23 1 C25 6 23 12 16 15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {leaves.map(([x, y, r]) => (
        <g key={`l${x}`}>
          <ellipse cx={x} cy={y} rx="1.5" ry="2.6" transform={`rotate(${r} ${x} ${y})`} fill="currentColor" />
          <ellipse cx={28 - x} cy={y} rx="1.5" ry="2.6" transform={`rotate(${-r} ${28 - x} ${y})`} fill="currentColor" />
        </g>
      ))}
    </svg>
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
