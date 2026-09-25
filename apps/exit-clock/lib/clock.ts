import type { Holder } from "./data";

/**
 * Pure time and geometry helpers shared by the client components. Hours in; degrees and strings out.
 * Everything here is unit-safe by construction: milliseconds only ever become hours through HOUR_MS.
 */
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** The future half of the dial spans 30 days on a log curve; the 30° before 12 o'clock is the overdue wedge. */
export const DIAL_HORIZON_HOURS = 720;
export const FUTURE_SWEEP_DEG = 330;
export const OVERDUE_SWEEP_DEG = 30;
const LOG_MAX = Math.log1p(DIAL_HORIZON_HOURS);

/**
 * Hours until an expected exit → degrees clockwise from 12 o'clock (12 = now).
 * Positive hours sweep clockwise through 1h, 6h, 1d, 1w, 30d. Negative hours (overdue) sit in the
 * wedge just before 12, deeper the longer they are overdue.
 */
export function hoursToAngle(hours: number): number {
  if (!Number.isFinite(hours)) return 0;
  const t = Math.min(1, Math.log1p(Math.abs(hours)) / LOG_MAX);
  return hours >= 0 ? FUTURE_SWEEP_DEG * t : -OVERDUE_SWEEP_DEG * t;
}

export interface ScaleMark {
  hours: number;
  label?: string;
}

/** Engraved scale: labelled marks are brass, the rest are minor ticks. */
export const SCALE_MARKS: readonly ScaleMark[] = [
  { hours: 1, label: "1H" },
  { hours: 2 },
  { hours: 3 },
  { hours: 6, label: "6H" },
  { hours: 12, label: "12H" },
  { hours: 18 },
  { hours: 24, label: "1D" },
  { hours: 36 },
  { hours: 48, label: "2D" },
  { hours: 72, label: "3D" },
  { hours: 96 },
  { hours: 120, label: "5D" },
  { hours: 168, label: "1W" },
  { hours: 240 },
  { hours: 336, label: "2W" },
  { hours: 480 },
  { hours: 720, label: "30D" },
];

export function remainingMs(expectedExitAt: string, now: number): number {
  const t = Date.parse(expectedExitAt);
  return Number.isFinite(t) ? t - now : 0;
}

export type ExitState = "overdue" | "imminent" | "soon" | "holding";

export function exitState(ms: number): ExitState {
  if (ms <= 0) return "overdue";
  if (ms < HOUR_MS) return "imminent";
  if (ms < DAY_MS) return "soon";
  return "holding";
}

export const STATE_LABEL: Record<ExitState, string> = {
  overdue: "Overdue",
  imminent: "Exiting",
  soon: "Today",
  holding: "Holding",
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** "3d 04:12:09", "04:12:09", or "−1d 02:03:04" when overdue. Whole seconds, always ticking. */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms)) return "--:--:--";
  const neg = ms < 0;
  const total = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${neg ? "−" : ""}${d > 0 ? `${d}d ` : ""}${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** Hours → "45m", "9.5h", "14h", "2d 6h", "21d". */
export function formatHold(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return "—";
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return hours >= 10 || Number.isInteger(hours) ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
  let d = Math.floor(hours / 24);
  let rest = Math.round(hours - d * 24);
  if (rest === 24) {
    d += 1;
    rest = 0;
  }
  if (d >= 10 || rest === 0) return `${Math.round(hours / 24)}d`;
  return `${d}d ${rest}h`;
}

/** "just now", "35m ago", "5h ago", "3d ago" (or "… from now" for future instants). */
export function formatAgo(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const suffix = ms >= 0 ? " ago" : " from now";
  const s = Math.abs(ms) / 1000;
  if (s < 90) return "just now";
  const m = s / 60;
  if (m < 90) return `${Math.round(m)}m${suffix}`;
  const h = m / 60;
  if (h < 36) return `${Math.round(h)}h${suffix}`;
  return `${Math.round(h / 24)}d${suffix}`;
}

/** Where a hand's countdown starts from, in words. Estimated anchors are marked "est.". */
export function anchorText(h: Pick<Holder, "anchorAt" | "anchorSource">, now: number): string {
  switch (h.anchorSource) {
    case "trade":
      return `bought ${formatAgo(h.anchorAt, now)}`;
    case "24h":
      return "added <24h ago (est.)";
    case "7d":
      return "added <7d ago (est.)";
    case "30d":
      return "added <30d ago (est.)";
    default:
      return "held 30d+";
  }
}

/** "12:00:00" from a timestamp, UTC. */
export function utcClock(now: number): string {
  return new Date(now).toISOString().slice(11, 19);
}
