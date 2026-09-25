"use client";
import { social } from "@longitude/kit";
import { useCallback, useEffect, useRef, useState } from "react";

/** What a watched hand remembers about itself, so it still reads when its token has left the snapshot. */
export type WatchData = {
  symbol: string;
  chain: string;
  tokenAddress: string;
  address: string;
  label: string;
  expectedExitAt: string;
  valueUsd: number;
};

export interface WatchItem {
  id: string;
  addedAt: string;
  data: WatchData;
}

export const watchId = (chain: string, tokenAddress: string, address: string): string => `${chain}:${tokenAddress}:${address}`;

function parseWatch(raw: { id: string; addedAt: string; data: Record<string, unknown> }): WatchItem | null {
  const d = raw.data ?? {};
  const s = (k: string): string | null => (typeof d[k] === "string" && (d[k] as string).length > 0 ? (d[k] as string) : null);
  const symbol = s("symbol");
  const chain = s("chain");
  const tokenAddress = s("tokenAddress");
  const address = s("address");
  const expectedExitAt = s("expectedExitAt");
  if (!symbol || !chain || !tokenAddress || !address || !expectedExitAt || !Number.isFinite(Date.parse(expectedExitAt))) return null;
  const valueUsd = Number(d.valueUsd ?? 0);
  return {
    id: raw.id,
    addedAt: raw.addedAt,
    data: { symbol, chain, tokenAddress, address, label: s("label") ?? "Smart Money", expectedExitAt, valueUsd: Number.isFinite(valueUsd) ? valueUsd : 0 },
  };
}

/**
 * The visitor's watchlist: loaded once after mount, updated optimistically, rolled back when the
 * social API says no. Every call swallows failures, so with the API unreachable this is an empty
 * list whose toggles quietly do nothing: the clock behaves exactly as it does without it.
 */
export function useWatchlist() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef<WatchItem[]>([]);
  latest.current = items;

  useEffect(() => {
    let alive = true;
    void social.items("watch").then((r) => {
      if (!alive) return;
      if (r?.ok) setItems(r.items.map(parseWatch).filter((i): i is WatchItem => i !== null));
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  const add = useCallback((id: string, data: WatchData) => {
    setItems((cur) => [{ id, addedAt: new Date().toISOString(), data }, ...cur.filter((i) => i.id !== id)]);
    void social.addItem("watch", id, { ...data }).then((r) => {
      if (!r?.ok) setItems((cur) => cur.filter((i) => i.id !== id));
    });
  }, []);

  const remove = useCallback((id: string) => {
    const removed = latest.current.find((i) => i.id === id);
    setItems((cur) => cur.filter((i) => i.id !== id));
    void social.removeItem("watch", id).then((r) => {
      if (!r?.ok && removed) setItems((cur) => (cur.some((i) => i.id === id) ? cur : [removed, ...cur]));
    });
  }, []);

  return { items, loaded, has, add, remove };
}
