/**
 * Deep mode: the bigger build (more wallets, more tokens, longer history). A seed turns it on with
 * DEEP=1 in its environment. The daily cron turns it on for its own run only (see cron.ts), so the
 * overnight refresh keeps the rich data while a visitor's "Refresh live" still gets the lighter,
 * cheaper build. No Node APIs in this file, so any builder can import it.
 */
interface Scope {
  getStore(): boolean | undefined;
}

const holder = globalThis as typeof globalThis & { __longitudeDeepScope?: Scope };

export function isDeep(): boolean {
  const scoped = holder.__longitudeDeepScope?.getStore();
  if (scoped !== undefined) return scoped;
  return typeof process !== "undefined" && process.env?.DEEP === "1";
}

/** Server only: cron.ts installs its AsyncLocalStorage here so deep mode is scoped to one request. */
export function setDeepScope(scope: Scope): void {
  holder.__longitudeDeepScope = scope;
}
