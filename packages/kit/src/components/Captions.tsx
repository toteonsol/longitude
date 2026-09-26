"use client";
import { useEffect, useState } from "react";
import { APPS } from "../apps";
import { appUrl, storeUrl } from "../urls";

/**
 * Recording mode. Open any LONGITUDE page with ?rec=1 and a caption bar narrates what is on screen,
 * so a screen recording explains itself without a voiceover. The flag rides along on links between
 * the store and the apps, and ?rec=0 turns it off. Nobody else ever sees the bar.
 */
const KEY = "lg:rec";
const EVENT = "lg:caption";

/** The latest caption, kept so one fired while the page is still mounting shows once the bar is ready. */
let latest: { text: string; until: number } | null = null;

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const param = new URLSearchParams(window.location.search).get("rec");
    if (param === "1") window.sessionStorage.setItem(KEY, "1");
    if (param === "0") window.sessionStorage.removeItem(KEY);
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function longitudeOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const url of [storeUrl(), ...APPS.map((app) => appUrl(app.id))]) {
    try {
      origins.add(new URL(url).origin);
    } catch {
      // A malformed env value just means that app is not recognised.
    }
  }
  return origins;
}

/** Adds rec=1 to a link into another LONGITUDE app while recording. Call it in event handlers only. */
export function withRecording(url: string): string {
  if (!readFlag()) return url;
  try {
    const next = new URL(url, window.location.href);
    if (next.origin === window.location.origin || !longitudeOrigins().has(next.origin)) return url;
    next.searchParams.set("rec", "1");
    return next.toString();
  } catch {
    return url;
  }
}

/**
 * Shows a caption for a moment while recording, then falls back to the page's own caption. Safe to
 * call anywhere in client code; outside recording mode it does nothing visible.
 */
export function caption(text: string, holdMs = 4500): void {
  if (typeof window === "undefined") return;
  latest = { text, until: Date.now() + holdMs };
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, holdMs } }));
}

interface Props {
  /** Small label above the caption, usually the app's name. */
  kicker: string;
  /** What the page shows, in one or two plain sentences. */
  base: string;
}

export function Captions({ kicker, base }: Props) {
  const [on, setOn] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setOn(readFlag());
  }, []);

  useEffect(() => {
    if (!on) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (text: string, holdMs: number) => {
      clearTimeout(timer);
      setFlash(text);
      timer = setTimeout(() => setFlash(null), holdMs);
    };
    const onCaption = (e: Event) => {
      const { text, holdMs } = (e as CustomEvent<{ text: string; holdMs: number }>).detail;
      show(text, holdMs);
    };
    // A caption fired before this listener existed (say, on the first render of a live page).
    if (latest && latest.until > Date.now()) show(latest.text, latest.until - Date.now());
    // Carry the flag into the next app: rewrite cross-app links at the moment they are clicked.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const next = withRecording(link.href);
      if (next !== link.href) link.href = next;
    };
    window.addEventListener(EVENT, onCaption);
    document.addEventListener("click", onClick, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(EVENT, onCaption);
      document.removeEventListener("click", onClick, true);
    };
  }, [on]);

  const text = flash ?? base;
  if (!on) return null;
  return (
    <div className="lg-caption" role="status" aria-live="polite">
      <span className="lg-caption__kicker">{kicker}</span>
      <p key={text} className="lg-caption__text">
        {text}
      </p>
    </div>
  );
}
