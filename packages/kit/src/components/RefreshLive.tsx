"use client";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import type { DataSource } from "../load";

interface Props {
  source: DataSource;
  /** Hide the button entirely (apps whose data has no live path). */
  disabled?: boolean;
}

/**
 * "Refresh live" navigates to ?live=1: the server component re-renders with live Nansen data,
 * served from the shared client cache for five minutes. A paid Pro refresh forces fresh calls.
 */
export function RefreshLive({ source, disabled }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  if (disabled) return null;
  const isLive = source.kind === "live";
  const go = () => start(() => router.push(`${pathname}?live=1`));
  const back = () => start(() => router.push(pathname));
  return (
    <span className="lg-refresh">
      <button type="button" className="lg-btn lg-btn--live" onClick={go} disabled={pending} aria-busy={pending}>
        <span className={`lg-dot${pending ? " lg-dot--busy" : isLive ? " lg-dot--live" : ""}`} aria-hidden="true" />
        {pending ? "Calling Nansen…" : isLive ? "Refresh again" : "Refresh live"}
      </button>
      {isLive && !pending ? (
        <button type="button" className="lg-btn lg-btn--ghost" onClick={back}>
          Back to snapshot
        </button>
      ) : null}
    </span>
  );
}
