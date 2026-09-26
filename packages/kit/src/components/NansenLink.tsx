"use client";
import type { SyntheticEvent } from "react";

const NANSEN_APP = "https://app.nansen.ai";
const isEvmAddress = (address: string) => /^0x[0-9a-fA-F]{40}$/.test(address);

/**
 * Nansen Profiler for a wallet. An EVM address opens across every chain; anything else is treated
 * as a Solana address unless a chain is given.
 */
export function nansenWalletUrl(address: string, chain?: string): string {
  const url = new URL("/profiler", NANSEN_APP);
  url.searchParams.set("address", address);
  if (!isEvmAddress(address)) url.searchParams.set("chain", chain ?? "solana");
  return url.toString();
}

/** Nansen Token God Mode for a token on one chain (chain names as the Nansen API spells them). */
export function nansenTokenUrl(address: string, chain: string): string {
  const url = new URL("/token-god-mode", NANSEN_APP);
  url.searchParams.set("tokenAddress", address);
  url.searchParams.set("chain", chain);
  return url.toString();
}

interface Props {
  /** Wallet address, or the token's contract address. */
  address: string | undefined | null;
  /** Chain as the Nansen API spells it (ethereum, solana, base...). Required for tokens. */
  chain?: string | null;
  kind?: "wallet" | "token";
  /** Visible text. Defaults to "Nansen". */
  label?: string;
  className?: string;
}

/**
 * A small "Nansen" pill that opens the wallet or token in Nansen's own app. Costs no credits. It stops
 * clicks, keys and pointer presses from reaching the card around it, so a flip or a drag never fires.
 * Never nest it inside another link or a button; put it beside them.
 */
export function NansenLink({ address, chain, kind = "wallet", label = "Nansen", className }: Props) {
  if (!address) return null;
  if (kind === "token" && !chain) return null;
  const href = kind === "token" ? nansenTokenUrl(address, chain as string) : nansenWalletUrl(address, chain ?? undefined);
  const what = kind === "token" ? "Open this token in Nansen Token God Mode" : "Open this wallet in Nansen Profiler";
  const stop = (e: SyntheticEvent) => e.stopPropagation();
  return (
    <a
      className={`lg-nansen${className ? ` ${className}` : ""}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={what}
      aria-label={what}
      onClick={stop}
      onPointerDown={stop}
      onKeyDown={stop}
    >
      {label}
      <span className="lg-nansen__arrow" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}
