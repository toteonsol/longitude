import { type Commands, MemoryCommands } from "./commands";
import { IoRedisCommands } from "./redis";
import { SocialStore } from "./store";
import { UpstashCommands } from "./upstash";

export { SocialStore } from "./store";
export { MemoryCommands } from "./commands";
export type { Commands } from "./commands";
export { IoRedisCommands } from "./redis";
export { UpstashCommands } from "./upstash";
export { handleFor, newId, isValidId, shortId, ID_RE } from "./identity";
export type { Identity, Profile, FeedEvent, FeedEventType, ScoreEntry, Presence, ListItem } from "./types";

export type SocialBackend = "redis" | "upstash" | "memory";

export function socialBackend(): SocialBackend {
  if (process.env.REDIS_URL) return "redis";
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash";
  return "memory";
}

let shared: SocialStore | undefined;

/**
 * The process-wide store. Redis over TCP when REDIS_URL is set (Railway), Upstash REST when its
 * variables are set, else an in-memory store (development; state resets with the process).
 */
export function getSocialStore(): SocialStore {
  if (!shared) {
    let cmd: Commands;
    const backend = socialBackend();
    if (backend === "redis") cmd = new IoRedisCommands(process.env.REDIS_URL as string);
    else if (backend === "upstash") cmd = new UpstashCommands(process.env.UPSTASH_REDIS_REST_URL as string, process.env.UPSTASH_REDIS_REST_TOKEN as string);
    else cmd = new MemoryCommands();
    shared = new SocialStore(cmd);
  }
  return shared;
}
