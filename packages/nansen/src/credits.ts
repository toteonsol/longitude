import { CREDIT_COSTS, PREMIUM_LABEL_COST, PREMIUM_LABEL_ENDPOINTS } from "./generated/credits";
import { CreditCapExceededError } from "./errors";

/** What we charge against the cap for endpoints missing from the generated table. */
export const UNKNOWN_ENDPOINT_COST = 5;

/** Estimated credits for a call, before we see the X-Nansen-Credits-Used header. */
export function estimateCredits(endpoint: string, body?: unknown): number {
  if (
    PREMIUM_LABEL_ENDPOINTS.includes(endpoint) &&
    body &&
    typeof body === "object" &&
    (body as { premium_labels?: unknown }).premium_labels === true
  ) {
    return PREMIUM_LABEL_COST;
  }
  const known = CREDIT_COSTS[endpoint];
  return known ?? UNKNOWN_ENDPOINT_COST;
}

export function isKnownEndpoint(endpoint: string): boolean {
  return endpoint in CREDIT_COSTS;
}

/**
 * Per-process spend ceiling. `reserve` is called before a request with the estimate, then either
 * `commit` (with the real cost from the response header) or `release` on failure. Reservations make
 * the cap safe under concurrency: ten parallel 5-credit calls cannot sneak past a 20-credit cap.
 */
export class CreditCap {
  private _spent = 0;
  private _reserved = 0;
  private _calls = 0;

  constructor(readonly cap: number | null) {}

  get spent(): number {
    return this._spent;
  }
  get reserved(): number {
    return this._reserved;
  }
  get calls(): number {
    return this._calls;
  }
  get remaining(): number {
    return this.cap === null ? Number.POSITIVE_INFINITY : Math.max(0, this.cap - this._spent - this._reserved);
  }

  reserve(estimated: number, endpoint: string): void {
    if (this.cap !== null && this._spent + this._reserved + estimated > this.cap) {
      throw new CreditCapExceededError(endpoint, estimated, this._spent, this._reserved, this.cap);
    }
    this._reserved += estimated;
  }

  commit(estimated: number, actual: number): void {
    this._reserved = Math.max(0, this._reserved - estimated);
    this._spent += actual;
    this._calls += 1;
  }

  release(estimated: number): void {
    this._reserved = Math.max(0, this._reserved - estimated);
  }

  /** Would a call of this size fit right now? (No side effects.) */
  canAfford(estimated: number): boolean {
    return this.cap === null || this._spent + this._reserved + estimated <= this.cap;
  }
}

export function creditCapFromEnv(): number {
  const raw = process.env.NANSEN_CREDIT_CAP;
  if (raw === undefined || raw === "") return 500;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 500;
  return n;
}
