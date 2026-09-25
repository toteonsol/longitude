import type { Action } from "./data";

/** "11:42" (UTC) from an ISO timestamp. */
export const hhmm = (iso: string): string => new Date(iso).toISOString().slice(11, 16);

export const VERB: Record<Action, string> = { buy: "bought", sell: "sold", swap: "rotated into" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "September 25, 2026" from "2026-09-25". Locale-free so the server and the client agree. */
export function longDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1] ?? ""} ${d ?? ""}, ${y ?? ""}`.trim();
}
