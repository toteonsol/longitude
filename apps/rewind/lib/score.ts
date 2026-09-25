import { useCallback, useEffect, useMemo, useState } from "react";

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

/** The running score, persisted in localStorage. `ready` flips after mount so SSR and the first paint agree. */
export function useScore() {
  const [state, setState] = useState<ScoreState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);

  const record = useCallback((date: string, pick: string, hit: boolean) => {
    setState((prev) => {
      const next: ScoreState = { results: { ...prev.results, [date]: { pick, hit, at: new Date().toISOString() } } };
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(EMPTY);
    save(EMPTY);
  }, []);

  const summary = useMemo(() => summarize(state), [state]);
  return { state, summary, ready, record, reset };
}
