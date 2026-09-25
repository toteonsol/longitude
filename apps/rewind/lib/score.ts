import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** One graded call per tape date. Replaying a tape overwrites its entry, so nothing double-counts. */
export interface CallResult {
  pick: string;
  hit: boolean;
  at: string;
}

export interface ScoreState {
  results: Record<string, CallResult>;
}

export interface ScoreSummary {
  answered: number;
  hits: number;
  /** Consecutive hits, most recent calls first. */
  streak: number;
  best: number;
}

const KEY = "longitude:rewind:score";
/** Tape dates this visitor has already been awarded points for. CLEAR never touches it: the boards are additive. */
const AWARD_KEY = "longitude:rewind:awarded";
const EMPTY: ScoreState = { results: {} };

function load(): ScoreState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ScoreState>;
    return { results: parsed.results && typeof parsed.results === "object" ? parsed.results : {} };
  } catch {
    return EMPTY;
  }
}

function save(state: ScoreState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

export function summarize(state: ScoreState): ScoreSummary {
  const ordered = Object.values(state.results).sort((a, b) => a.at.localeCompare(b.at));
  let run = 0;
  let best = 0;
  for (const r of ordered) {
    run = r.hit ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { answered: ordered.length, hits: ordered.filter((r) => r.hit).length, streak: run, best };
}

const awardedThisSession = new Set<string>();

/**
 * True the first time this visitor reveals a given tape date, false on every replay after that
 * (across sessions via localStorage, within the session even where storage is unavailable).
 */
export function claimAward(date: string): boolean {
  if (awardedThisSession.has(date)) return false;
  awardedThisSession.add(date);
  try {
    const raw = localStorage.getItem(AWARD_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    const dates = Array.isArray(list) ? list.filter((d): d is string => typeof d === "string") : [];
    if (dates.includes(date)) return false;
    localStorage.setItem(AWARD_KEY, JSON.stringify([...dates, date]));
  } catch {
    /* private mode: the in-memory set still guards this session */
  }
  return true;
}

/** The running score, persisted in localStorage. `ready` flips after mount so SSR and the first paint agree. */
export function useScore() {
  const [state, setState] = useState<ScoreState>(EMPTY);
  const [ready, setReady] = useState(false);
  const current = useRef<ScoreState>(EMPTY);

  useEffect(() => {
    const loaded = load();
    current.current = loaded;
    setState(loaded);
    setReady(true);
  }, []);

  /** Records a call and returns the summary as it stands after it (the streak boards want it synchronously). */
  const record = useCallback((date: string, pick: string, hit: boolean): ScoreSummary => {
    const next: ScoreState = { results: { ...current.current.results, [date]: { pick, hit, at: new Date().toISOString() } } };
    current.current = next;
    setState(next);
    save(next);
    return summarize(next);
  }, []);

  const reset = useCallback(() => {
    current.current = EMPTY;
    setState(EMPTY);
    save(EMPTY);
  }, []);

  const summary = useMemo(() => summarize(state), [state]);
  return { state, summary, ready, record, reset };
}
