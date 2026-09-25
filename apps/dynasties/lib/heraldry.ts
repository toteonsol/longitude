/**
 * Deterministic heraldry. Everything here is a pure function of an address so the seed, the page
 * and the crest SVG all agree without storing anything: hash the address once, then read bit
 * fields off it for the shield partition, the two tinctures, the charge and the house name.
 */

/** FNV-1a 32-bit over the lowercase address. */
export function hashAddress(address: string): number {
  let h = 0x811c9dc5;
  const s = address.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A second, independently mixed hash so names and arms do not correlate. */
export function hashAddress2(address: string): number {
  let x = (hashAddress(address) ^ 0x9e3779b9) >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export type Partition = "per pale" | "per fess" | "quarterly" | "per chevron";
export type Charge = "lion" | "star" | "key" | "tower" | "chevron" | "cross" | "crescent" | "sword";

export interface Tincture {
  name: string;
  hex: string;
  kind: "metal" | "colour";
}

export const METALS: readonly Tincture[] = [
  { name: "Or", hex: "#d9b544", kind: "metal" },
  { name: "Argent", hex: "#e9e3d2", kind: "metal" },
];

export const COLOURS: readonly Tincture[] = [
  { name: "Gules", hex: "#a3262c", kind: "colour" },
  { name: "Azure", hex: "#2a4a9c", kind: "colour" },
  { name: "Vert", hex: "#2f6f47", kind: "colour" },
  { name: "Purpure", hex: "#5e2d70", kind: "colour" },
  { name: "Sable", hex: "#1c1b24", kind: "colour" },
  { name: "Murrey", hex: "#6f2140", kind: "colour" },
];

const PARTITIONS: readonly Partition[] = ["per pale", "per fess", "quarterly", "per chevron"];
const CHARGES: readonly Charge[] = ["lion", "star", "key", "tower", "chevron", "cross", "crescent", "sword"];

const CHARGE_BLAZON: Record<Charge, string> = {
  lion: "a lion's face",
  star: "a mullet",
  key: "a key palewise",
  tower: "a tower",
  chevron: "a chevronel",
  cross: "a cross",
  crescent: "a crescent",
  sword: "a sword erect",
};

export interface Arms {
  partition: Partition;
  /** First (dexter / chief) tincture of the field. */
  first: Tincture;
  /** Second (sinister / base) tincture of the field. */
  second: Tincture;
  charge: Charge;
  chargeTincture: Tincture;
  /** Thin inner border in the opposite tincture, on a quarter of shields. */
  bordure: boolean;
  /** The arms described in heraldic English, e.g. "Per pale Or and Gules, a tower counterchanged". */
  blazon: string;
}

/** Reads a coat of arms off the address hash. Same address, same arms, forever. */
export function armsOf(address: string): Arms {
  const h = hashAddress(address);
  const partition = PARTITIONS[h & 3] ?? "per pale";
  const metal = METALS[(h >>> 2) & 1] ?? METALS[0]!;
  const colour = COLOURS[(h >>> 3) % COLOURS.length] ?? COLOURS[0]!;
  const metalFirst = ((h >>> 6) & 1) === 1;
  const charge = CHARGES[(h >>> 7) & 7] ?? "star";
  const bordure = ((h >>> 10) & 3) === 0;
  const first = metalFirst ? metal : colour;
  const second = metalFirst ? colour : metal;
  // Rule of tincture: the charge sits mostly on the first tincture, so it takes the other kind.
  // Half the shields are counterchanged (the charge in the second tincture); the rest take a third.
  const counterchanged = ((h >>> 12) & 1) === 1;
  const thirds = (first.kind === "metal" ? COLOURS : METALS).filter((t) => t.name !== second.name);
  const chargeTincture = counterchanged ? second : (thirds[(h >>> 13) % thirds.length] ?? second);
  const cap = partition.charAt(0).toUpperCase() + partition.slice(1);
  const chargeWord = chargeTincture.name === second.name ? "counterchanged" : chargeTincture.name;
  const blazon = `${cap} ${first.name} and ${second.name}, ${CHARGE_BLAZON[charge]} ${chargeWord}${bordure ? `, within a bordure ${second.kind === "metal" ? colour.name : metal.name}` : ""}`;
  return { partition, first, second, charge, chargeTincture, bordure, blazon };
}

const ONSETS = [
  "Val", "Mor", "Ash", "Bel", "Cor", "Dra", "Eld", "Fen", "Gal", "Hal", "Ith", "Kar", "Lor", "Mal", "Nor", "Ors",
  "Pel", "Quen", "Rav", "Sal", "Tor", "Ul", "Ver", "Wyn", "Yor", "Zar", "Bran", "Cas", "Dun", "Ever", "Grey", "Stor",
];
const MIDS = ["", "", "", "a", "e", "i", "o", "en"];
const CODAS = [
  "dor", "mund", "rick", "wyn", "ston", "gard", "thorne", "vane", "mere", "hart", "ley", "crest", "ford", "ward",
  "holm", "brook", "mont", "wick", "stead", "ridge", "fell", "bourne", "shaw", "combe",
];

/** A pronounceable house name from the address, e.g. "Valdor", "Morengard", "Ashwyn". */
export function houseName(address: string): string {
  const h = hashAddress2(address);
  const onset = ONSETS[h % ONSETS.length] ?? "Val";
  const mid = MIDS[(h >>> 5) % MIDS.length] ?? "";
  const coda = CODAS[(h >>> 9) % CODAS.length] ?? "dor";
  // Avoid doubled vowels at the seam ("Ulaard" reads badly).
  const seam = onset.slice(-1).toLowerCase();
  const joiner = mid && /[aeiou]/.test(seam) && /^[aeiou]/.test(mid) ? "" : mid;
  return `${onset}${joiner}${coda}`;
}
