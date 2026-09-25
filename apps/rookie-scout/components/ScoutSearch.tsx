"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Paste any wallet; get a live scouting report. */
export function ScoutSearch({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (v.length < 20) return;
    start(() => router.push(`/scout/${encodeURIComponent(v)}`));
  };
  return (
    <form className="scoutsearch" onSubmit={go}>
      <label className="scoutsearch__label" htmlFor="scout-address">
        Scout any wallet
      </label>
      <div className="scoutsearch__row">
        <input id="scout-address" className="scoutsearch__input lg-addr" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0x… or a Solana address" spellCheck={false} autoComplete="off" />
        <button type="submit" className="scoutsearch__go" disabled={pending || value.trim().length < 20}>
          {pending ? "Scouting…" : "Scout"}
        </button>
      </div>
      <small className="scoutsearch__hint">One live Nansen call, scored against today&apos;s smart money cohort.</small>
    </form>
  );
}
