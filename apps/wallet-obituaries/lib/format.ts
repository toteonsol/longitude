/**
 * Pure formatting shared by the copy desk (lib/data.ts) and the page. No Nansen imports, so it is
 * safe to bundle into client components.
 */

const CHAIN_NAMES: Record<string, string> = { ethereum: "Ethereum", solana: "Solana", base: "Base" };

export function chainName(chain: string): string {
  return CHAIN_NAMES[chain] ?? chain.charAt(0).toUpperCase() + chain.slice(1);
}

/** "1.20" → "1.2", "3.00" → "3". */
const trimZeros = (s: string): string => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);

/** "$1.84M", "$612K", "$43.5K", "$8,400", "$12". Negative values keep their sign. */
export function usd(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}$${trimZeros((a / 1e9).toFixed(2))}B`;
  if (a >= 1e6) return `${sign}$${trimZeros((a / 1e6).toFixed(2))}M`;
  if (a >= 1e5) return `${sign}$${Math.round(a / 1e3)}K`;
  if (a >= 1e4) return `${sign}$${trimZeros((a / 1e3).toFixed(1))}K`;
  if (a >= 1e3) return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
  if (a >= 1) return `${sign}$${Math.round(a)}`;
  return `${sign}$${a.toFixed(2)}`;
}

/** Token quantities: "184M", "12.4K", "3,120", "0.85". */
export function qty(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${trimZeros((a / 1e9).toFixed(2))}B`;
  if (a >= 1e6) return `${trimZeros((a / 1e6).toFixed(a >= 1e8 ? 0 : 1))}M`;
  if (a >= 1e4) return `${trimZeros((a / 1e3).toFixed(a >= 1e5 ? 0 : 1))}K`;
  if (a >= 100) return Math.round(a).toLocaleString("en-US");
  if (a >= 1) return trimZeros(a.toFixed(2));
  return trimZeros(a.toFixed(4));
}

/** "an Ethereum wallet", "a Solana wallet". */
export function article(noun: string): string {
  return /^[aeiou]/i.test(noun) ? "an" : "a";
}

export function pctText(n: number): string {
  return `${Math.round(n)}%`;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** Small counts in words, as a newspaper would set them. */
export function numWord(n: number): string {
  const i = Math.round(n);
  return WORDS[i] ?? i.toLocaleString("en-US");
}

/** "a, b and c". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "on Thursday morning", "late on Wednesday", "in the small hours of Friday". UTC. */
export function whenPhrase(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "this week";
  const day = DAYS[d.getUTCDay()] ?? "this week";
  const h = d.getUTCHours();
  if (h < 5) return `in the small hours of ${day}`;
  if (h < 12) return `on ${day} morning`;
  if (h < 17) return `on ${day} afternoon`;
  if (h < 21) return `on ${day} evening`;
  return `late on ${day}`;
}

/** "Thursday, September 25, 2026" from a YYYY-MM-DD edition date. Same string on server and client. */
export function longDate(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDay;
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** "Sep 24, 21:14 UTC". */
export function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}, ${hh}:${mm} UTC`;
}

const ROMAN: Array<[number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function roman(n: number): string {
  let v = Math.max(1, Math.round(n));
  let out = "";
  for (const [value, glyph] of ROMAN) {
    while (v >= value) {
      out += glyph;
      v -= value;
    }
  }
  return out;
}

export interface Explorer {
  name: string;
  tx: (hash: string) => string;
  address: (addr: string) => string;
}

const ETHERSCAN: Explorer = { name: "Etherscan", tx: (h) => `https://etherscan.io/tx/${h}`, address: (a) => `https://etherscan.io/address/${a}` };
const EXPLORERS: Record<string, Explorer> = {
  ethereum: ETHERSCAN,
  base: { name: "Basescan", tx: (h) => `https://basescan.org/tx/${h}`, address: (a) => `https://basescan.org/address/${a}` },
  solana: { name: "Solscan", tx: (h) => `https://solscan.io/tx/${h}`, address: (a) => `https://solscan.io/account/${a}` },
};

/** Where an obituary is "continued": the chain's block explorer. */
export function explorer(chain: string): Explorer {
  return EXPLORERS[chain] ?? ETHERSCAN;
}
