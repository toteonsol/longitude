import { sleep } from "./util";

/**
 * Concurrency gate plus minimum spacing between request starts. Keeps a burst of parallel seed
 * calls under the plan's per-second limit instead of bouncing off 429s.
 */
export class Limiter {
  private active = 0;
  private queue: Array<() => void> = [];
  private lastStart = 0;

  constructor(
    readonly maxConcurrency: number,
    readonly minIntervalMs: number,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      const wait = this.lastStart + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastStart = Date.now();
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }

  get pending(): number {
    return this.queue.length;
  }
}

export const PLAN_LIMITS = {
  free: { perSecond: 15, perMinute: 300 },
  pro: { perSecond: 75, perMinute: 1500 },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

/** Conservative defaults: ~60% of the per-second limit, modest concurrency. */
export function limiterForPlan(plan: Plan): Limiter {
  const rps = PLAN_LIMITS[plan].perSecond;
  return new Limiter(plan === "free" ? 4 : 8, Math.ceil(1000 / (rps * 0.6)));
}
