import type { NansenClient, RowOf } from "@longitude/nansen";
import { CreditCapExceededError } from "@longitude/nansen";
import { houseName } from "./heraldry";

/** Ethereum only: related wallets and first funders resolve best there. */
const CHAIN = "ethereum" as const;
const TIMEFRAME = 30 as const;
const HOUSES = 6;
const KIN_PER_HOUSE = 20;

/** Nansen's `relation` is free text; we fold it into five bloodlines for grouping and copy. */
export type RelationKind = "funded-by" | "common-funder" | "funded" | "deployer" | "other";

export interface Patriarch {
  address: string;
  label: string;
  /** Total PnL over the leaderboard window (realized + unrealized). */
  pnlUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  /** Percent 0..100. */
  winRate: number;
  trades: number;
  tokens: number;
}

export interface Founder {
  address: string;
  label: string;
  /** ISO timestamp of the first funding transaction. */
  at: string;
  txHash: string;
  chain: string;
}

export interface Member {
  address: string;
  label: string;
  /** Nansen's relation text, e.g. "Funded", "Funded by", "Common funder". */
  relation: string;
  kind: RelationKind;
  /** ISO timestamp of the transaction that ties the two wallets. */
  at: string;
  txHash: string;
}

/** One bloodline of a house: every member that shares a `relation`, in display order. */
export interface Branch {
  relation: string;
  kind: RelationKind;
  /** Heraldic name for the bloodline, e.g. "Sworn bannermen". */
  title: string;
  /** One line under the title, e.g. "Wallets this house raised". */
  epithet: string;
  count: number;
}

export interface House {
  rank: number;
  /** Generated from the patriarch's address, e.g. "Valdor". */
  name: string;
  patriarch: Patriarch;
  founder?: Founder;
  /** Flat, sorted by bloodline then date. Group by `relation` (or use `branches`) to draw the tree. */
  members: Member[];
  branches: Branch[];
  motto: string;
  /** Earliest dated tie in the house (founder or member), ISO. */
  foundedAt?: string;
}

export interface DynastiesData {
  generatedAt: string;
  chain: typeof CHAIN;
  timeframeDays: typeof TIMEFRAME;
  realm: { houses: number; members: number; founders: number; bloodlines: number };
  houses: House[];
}

type LeaderRow = RowOf<"/api/v1/smart-money/pnl-leaderboard">;
type RelatedRow = RowOf<"/api/v1/profiler/address/related-wallets">;
type FunderRow = RowOf<"/api/v1/profiler/address/first-funder">;

const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;
const pct = (v: number | null | undefined): number => {
  const n = Number(v ?? 0);
  return n <= 1 ? n * 100 : n;
};

/** Normalises whatever timestamp shape Nansen sends into ISO; leaves unparseable text alone. */
export function isoTimestamp(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toISOString();
}

export function relationKind(relation: string): RelationKind {
  const s = relation.toLowerCase();
  if (/common|same funder|shared funder|sibling/.test(s)) return "common-funder";
  if (/funded by|funder of|received from|first fund/.test(s)) return "funded-by";
  if (/fund|sent to/.test(s)) return "funded";
  if (/deploy|creat|contract/.test(s)) return "deployer";
  return "other";
}

const KIND_ORDER: readonly RelationKind[] = ["funded-by", "common-funder", "funded", "deployer", "other"];

const KIND_COPY: Record<RelationKind, { title: string; epithet: string; singular: string }> = {
  "funded-by": { title: "Liege lords", epithet: "Wallets that put coin in this house's purse", singular: "Liege lord" },
  "common-funder": { title: "Cousins", epithet: "Raised by the same hand as the patriarch", singular: "Cousin" },
  funded: { title: "Sworn bannermen", epithet: "Wallets this house raised", singular: "Bannerman" },
  deployer: { title: "Master builders", epithet: "Contracts and the hands that deployed them", singular: "Master builder" },
  other: { title: "Allies", epithet: "Kin by association", singular: "Ally" },
};

export function kindTitle(kind: RelationKind): string {
  return KIND_COPY[kind].singular;
}

/** A short motto read off the numbers. Deterministic, so the seed and the page agree. */
export function mottoFor(p: Patriarch, members: Member[], founder?: Founder): string {
  const count = (k: RelationKind) => members.filter((m) => m.kind === k).length;
  const funded = count("funded");
  const fundedBy = count("funded-by");
  const cousins = count("common-funder");
  if (p.pnlUsd < 0) return "The tide always returns";
  if (p.winRate >= 75 && p.trades >= 50) return "Patience is the sharpest blade";
  if (funded >= 6) return "Many hands, one purse";
  if (funded >= 3 && founder) return "What was given, we give again";
  if (cousins >= 4) return "Blood is thicker than gas";
  if (fundedBy >= 2) return "We remember who fed us";
  if (p.tokens >= 40) return "A seat at every table";
  if (p.winRate >= 60 && p.trades >= 100) return "Slow to draw, quick to strike";
  if (members.length <= 3) return "Few, but unbowed";
  if (p.trades >= 200) return "No rest for the ledger";
  return "Ever forward, never idle";
}

export function toPatriarch(row: LeaderRow): Patriarch {
  return {
    address: row.address,
    label: row.address_label ?? "Smart Money",
    pnlUsd: num(row.total_pnl_usd),
    realizedPnlUsd: num(row.realized_pnl_usd),
    unrealizedPnlUsd: num(row.unrealized_pnl_usd),
    winRate: pct(row.win_rate),
    trades: num(row.n_trades),
    tokens: num(row.n_tokens),
  };
}

export function toMember(row: RelatedRow): Member {
  return {
    address: row.address,
    label: row.address_label ?? "",
    relation: row.relation,
    kind: relationKind(row.relation),
    at: isoTimestamp(row.block_timestamp),
    txHash: row.transaction_hash,
  };
}

export function toFounder(row: FunderRow): Founder {
  return {
    address: row.first_funder_address,
    label: row.first_funder_name ?? "",
    at: isoTimestamp(row.block_timestamp),
    txHash: row.transaction_hash,
    chain: row.chain,
  };
}

/**
 * Turns raw kin into a house: drops the patriarch and the founder from the member list, dedupes
 * addresses (keeping the earliest tie), orders by bloodline then date, and writes the branches,
 * the name and the motto. The seed and the sample snapshot both go through here.
 */
export function assembleHouse(rank: number, patriarch: Patriarch, kin: Member[], founder?: Founder): House {
  const self = patriarch.address.toLowerCase();
  const founderAddr = founder?.address.toLowerCase();
  const seen = new Map<string, Member>();
  for (const m of kin) {
    const a = m.address.toLowerCase();
    if (!a || a === self || a === founderAddr) continue;
    const prev = seen.get(a);
    if (!prev || (m.at && (!prev.at || m.at < prev.at))) seen.set(a, m);
  }
  const members = [...seen.values()].sort((a, b) => {
    const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (k !== 0) return k;
    if (a.relation !== b.relation) return a.relation.localeCompare(b.relation);
    return a.at.localeCompare(b.at);
  });

  const byRelation = new Map<string, Member[]>();
  for (const m of members) byRelation.set(m.relation, [...(byRelation.get(m.relation) ?? []), m]);
  const branches: Branch[] = [...byRelation.entries()].map(([relation, list]) => {
    const kind = list[0]?.kind ?? "other";
    return { relation, kind, title: KIND_COPY[kind].title, epithet: KIND_COPY[kind].epithet, count: list.length };
  });

  const dates = [founder?.at, ...members.map((m) => m.at)].filter((d): d is string => Boolean(d)).sort();
  return {
    rank,
    name: houseName(patriarch.address),
    patriarch,
    founder,
    members,
    branches,
    motto: mottoFor(patriarch, members, founder),
    foundedAt: dates[0],
  };
}

export function finishRealm(houses: House[]): DynastiesData {
  return {
    generatedAt: new Date().toISOString(),
    chain: CHAIN,
    timeframeDays: TIMEFRAME,
    realm: {
      houses: houses.length,
      members: houses.reduce((n, h) => n + h.members.length, 0),
      founders: houses.filter((h) => h.founder).length,
      bloodlines: houses.reduce((n, h) => n + h.branches.length, 0),
    },
    houses,
  };
}

function rethrowIfCap(err: unknown): void {
  if (err instanceof CreditCapExceededError) throw err;
}

/**
 * Builds the realm. Credits on a full run: 5 (leaderboard) + 6 houses x (1 related wallets + 1 first
 * funder) = 17, under the 30 budget. A house whose kin or funder call fails still gets drawn.
 */
export async function buildDynasties(nansen: NansenClient): Promise<DynastiesData> {
  // 1) The patriarchs: the six best smart money wallets on Ethereum this month. 5 credits.
  const board = await nansen.smartMoney.pnlLeaderboard({
    chains: [CHAIN],
    timeframe: TIMEFRAME,
    pagination: { page: 1, per_page: HOUSES },
  });
  const rows: LeaderRow[] = (board.data ?? []).slice(0, HOUSES);

  const houses: House[] = [];
  for (const [i, row] of rows.entries()) {
    const patriarch = toPatriarch(row);
    const tag = `house:${row.address.slice(0, 8)}`;

    // 2) The kin: wallets tied to the patriarch by funding or shared activity. 1 credit.
    let kin: RelatedRow[] = [];
    try {
      const related = await nansen.profiler.relatedWallets(
        { wallet_address: row.address, chain: CHAIN, pagination: { page: 1, per_page: KIN_PER_HOUSE } },
        { tag },
      );
      kin = related.data ?? [];
    } catch (err) {
      rethrowIfCap(err);
    }

    // 3) The founder: whoever sent the patriarch its first coin, resolved across chains. 1 credit.
    let founder: Founder | undefined;
    try {
      const funder = await nansen.profiler.firstFunder({ address: row.address, chain: "all" }, { tag });
      const first = (funder.data ?? [])[0];
      if (first?.first_funder_address) founder = toFounder(first);
    } catch (err) {
      rethrowIfCap(err);
    }

    houses.push(assembleHouse(i + 1, patriarch, kin.map(toMember), founder));
  }

  return finishRealm(houses);
}
