import type { Action, Episode } from "./data";

/** The line that goes out with a share. The header button and the end card use the same one. */
export const episodeShareText = (e: Episode): string =>
  `As The Chain Turns, Ep. ${e.number}: "${e.title}". ${e.synopsis} LONGITUDE, built on @nansen_ai`;

/** "11:42" (UTC) from an ISO timestamp. */
export const hhmm = (iso: string): string => new Date(iso).toISOString().slice(11, 16);

export const VERB: Record<Action, string> = { buy: "bought", sell: "sold", swap: "rotated into" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "September 25, 2026" from "2026-09-25". Locale-free so the server and the client agree. */
export function longDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1] ?? ""} ${d ?? ""}, ${y ?? ""}`.trim();
}
