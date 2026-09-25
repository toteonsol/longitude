"use client";

/** A small round ink seal with a tick: the mark of a specimen logged in the journal. */
export function Stamp({ className, label }: { className?: string; label?: string }) {
  return (
    <svg className={`stamp${className ? ` ${className}` : ""}`} viewBox="0 0 28 28" role={label ? "img" : undefined} aria-hidden={label ? undefined : true} focusable="false">
      {label ? <title>{label}</title> : null}
      <circle cx="14" cy="14" r="11.5" className="stamp__ring" />
      <circle cx="14" cy="14" r="8.8" className="stamp__ring stamp__ring--inner" />
      <path d="M8.6 14.6 L12.2 18 L19.6 9.8" className="stamp__tick" />
    </svg>
  );
}
