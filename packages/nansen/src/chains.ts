/** Chain identifiers accepted by the API. See https://docs.nansen.ai/reference/chains */
export const EVM_CHAINS = [
  "arbitrum", "arc", "avalanche", "base", "bitlayer", "bnb", "chiliz", "citrea", "ethereum",
  "gravity", "hyperevm", "iotaevm", "katana", "linea", "mantle", "metis", "monad", "optimism",
  "plasma", "polygon", "robinhood", "sei", "sonic", "viction",
] as const;

export const NON_EVM_CHAINS = [
  "algorand", "aptos", "bitcoin", "hyperliquid", "injective", "mantra", "near", "solana", "stacks",
  "starknet", "stellar", "sui", "ton", "tron",
] as const;

export const CHAINS = [...EVM_CHAINS, ...NON_EVM_CHAINS] as const;
export type Chain = (typeof CHAINS)[number];
export type ChainOrAll = Chain | "all";

export const isEvmChain = (c: string): c is (typeof EVM_CHAINS)[number] =>
  (EVM_CHAINS as readonly string[]).includes(c);

/** Chains with the deepest Smart Money + TGM + historical coverage; the default set for the apps. */
export const CORE_CHAINS = ["ethereum", "solana", "base", "bnb", "arbitrum"] as const satisfies readonly Chain[];

const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Loose address sanity check by chain family (the API does the strict one). */
export function looksLikeAddress(address: string, chain: string): boolean {
  if (isEvmChain(chain)) return EVM_RE.test(address);
  if (chain === "solana") return SOL_RE.test(address);
  return address.length > 10;
}

export function shortAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
