import { type NansenClient, type NansenClientOptions, defaultSinks, getNansen } from "@longitude/nansen";
import { sharedSink } from "./social/logsink";

/**
 * The client apps use for live requests: the per-process singleton plus the shared call-log sink
 * when a hosted store is configured, so every deployment's calls count on the store's globe.
 */
export function nansenFor(script: string, opts: Omit<NansenClientOptions, "script" | "logger"> = {}): NansenClient {
  const shared = sharedSink();
  return getNansen(script, { ...opts, logger: shared ? [...defaultSinks(), shared] : undefined });
}
