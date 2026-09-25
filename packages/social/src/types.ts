export interface Identity {
  /** Anonymous, client-generated, 8-40 chars of [a-z0-9-]. */
  id: string;
  /** Deterministic from the id, e.g. "Quiet Fox 42". */
  handle: string;
}

export interface Profile extends Identity {
  createdAt: string;
  lastSeen: string;
  /** Optional wallet or ENS/SNS name once connected. */
  wallet?: string;
  displayName?: string;
}

export type FeedEventType =
  | "visit"
  | "draft"
  | "call"
  | "score"
  | "watch"
  | "react"
  | "share"
  | "stamp"
  | "collect"
  | "custom";

export interface FeedEvent {
  id: string;
  ts: string;
  app: string;
  type: FeedEventType;
  actor: Identity;
  /** One line, already human-readable: "Quiet Fox drafted 8MHU…WJP7b". */
  text: string;
  /** Optional link into the app. */
  href?: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface ScoreEntry {
  id: string;
  handle: string;
  score: number;
  rank: number;
}

export interface Presence {
  count: number;
  /** A sample of handles currently here. */
  handles: string[];
}

export interface ListItem {
  id: string;
  addedAt: string;
  data: Record<string, unknown>;
}
