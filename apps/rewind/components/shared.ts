/** The deck's phase machine: pick → LOCK → PLAY → verdict. STOP goes back to idle. */
export type Phase = "idle" | "locked" | "playing" | "revealed";

/** Seconds each price path takes to draw. */
export const DRAW_SECONDS = 2;
/** Seconds from PLAY to the verdict: the last path finishes drawing, the tickers land, then the stamps. */
export const PLAY_SECONDS = 2.4;

/** One chroma per cassette slot: magenta, cyan, yellow, green. */
export const PICK_COLORS = ["#ff3ea5", "#2be0ff", "#ffe14d", "#7cff6b"] as const;

export const pickColor = (i: number): string => PICK_COLORS[i % PICK_COLORS.length] ?? PICK_COLORS[0];
