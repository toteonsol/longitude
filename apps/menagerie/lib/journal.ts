import type { SpeciesId } from "./data";

/** The social layer's list that holds a visitor's logged specimens, and the naturalists' board. */
export const SPECIMEN_LIST = "specimens";
export const NATURALIST_BOARD = "menagerie";

/** A specimen logged in the visitor's field journal. */
export interface CollectedItem {
  species: SpeciesId;
  label: string;
  chain: string;
  addedAt: string;
}

export const article = (word: string): string => (/^[aeiou]/i.test(word) ? "an" : "a");

export const shortDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
