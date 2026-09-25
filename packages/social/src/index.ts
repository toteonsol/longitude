import { type Commands, MemoryCommands } from "./commands";
import { ConvexCommands } from "./convex";
import { FileCommands } from "./file";
import { IoRedisCommands } from "./redis";
import { SocialStore } from "./store";
import { UpstashCommands } from "./upstash";

export { SocialStore } from "./store";
export { MemoryCommands } from "./commands";
export { FileCommands } from "./file";
export { ConvexCommands } from "./convex";
export { pushSnapshot, fetchManifest } from "./snapshots";
export type { SnapshotUpload } from "./snapshots";
export type { Commands } from "./commands";
export { IoRedisCommands } from "./redis";
export { UpstashCommands } from "./upstash";
export { handleFor, newId, isValidId, shortId, ID_RE } from "./identity";
export type { Identity, Profile, FeedEvent, FeedEventType, ScoreEntry, Presence, ListItem } from "./types";

export type SocialBackend = "convex" | "redis" | "upstash" | "file" | "memory";

const serverless = () => Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

export function socialBackend(): SocialBackend {
  if (process.env.CONVEX_URL) return "convex";
  if (process.env.REDIS_URL) return "redis";
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash";
  if (process.env.SOCIAL_FILE || (!serverless() && process.env.NODE_ENV !== "test")) return "file";
  return "memory";
}

/** Local dev shares one JSON file across all dev servers (SOCIAL_FILE overrides the path). */
export function socialFilePath(): string {
  if (process.env.SOCIAL_FILE) return process.env.SOCIAL_FILE;
  // walk up from cwd to the workspace root, else cwd
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return path.join(dir, "data", "social.json");
    const parent = path.dirname(dir);
    if (parent === dir) return path.join(process.cwd(), "data", "social.json");
    dir = parent;
  }
}

let shared: SocialStore | undefined;

/**
 * The process-wide store. Convex when CONVEX_URL is set, Redis over TCP when REDIS_URL is set,
 * Upstash REST when its variables are set, a shared JSON file in local development, else memory.
 */
export function getSocialStore(): SocialStore {
  if (!shared) {
    let cmd: Commands;
    const backend = socialBackend();
    if (backend === "convex") cmd = new ConvexCommands(process.env.CONVEX_URL as string);
    else if (backend === "redis") cmd = new IoRedisCommands(process.env.REDIS_URL as string);
    else if (backend === "upstash") cmd = new UpstashCommands(process.env.UPSTASH_REDIS_REST_URL as string, process.env.UPSTASH_REDIS_REST_TOKEN as string);
    else if (backend === "file") cmd = new FileCommands(socialFilePath());
    else cmd = new MemoryCommands();
    shared = new SocialStore(cmd);
  }
  return shared;
}
