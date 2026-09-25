"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { social, useIdentity } from "../social/client";

const PAY_TO = process.env.NEXT_PUBLIC_X402_PAY_TO;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_X402_CHAIN_ID ?? "84532");
const PRICE = process.env.NEXT_PUBLIC_X402_PRICE ?? "$0.05";
const CHAIN_NAME = CHAIN_ID === 8453 ? "Base" : "Base Sepolia";

type State = "idle" | "connecting" | "paying" | "done" | "error";

interface EthProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/**
 * "Pro refresh": pays the configured USDC price over x402 from the visitor's browser wallet, then
 * navigates to the live view. Hidden unless NEXT_PUBLIC_X402_PAY_TO is set. Never blocks the free path.
 */
export function ProRefresh({ appName }: { appName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const me = useIdentity();
  const [state, setState] = useState<State>("idle");
  const [note, setNote] = useState<string>("");
  const [, start] = useTransition();
  if (!PAY_TO) return null;
  const paid = params.get("pro") === "1";

  const run = async () => {
    try {
      setState("connecting");
      setNote("");
      const eth = (window as unknown as { ethereum?: EthProvider }).ethereum;
      if (!eth) throw new Error("No browser wallet found. Install Coinbase Wallet or MetaMask, fund it with USDC on " + CHAIN_NAME + ".");
      const { createWalletClient, custom } = await import("viem");
      const wallet = createWalletClient({ transport: custom(eth as never) });
      const [address] = await wallet.requestAddresses();
      if (!address) throw new Error("Wallet did not return an address.");
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }] });
      } catch {
        /* the wallet may already be on the chain, or refuse; the payment will tell */
      }
      const signer = {
        address,
        signTypedData: (m: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> }) =>
          wallet.signTypedData({ account: address, domain: m.domain, types: m.types, primaryType: m.primaryType, message: m.message } as never),
      };
      const [{ x402Client }, { ExactEvmScheme }, { wrapFetchWithPayment }] = await Promise.all([import("@x402/core/client"), import("@x402/evm/exact/client"), import("@x402/fetch")]);
      const client = new x402Client();
      client.register("eip155:*" as never, new ExactEvmScheme(signer) as never);
      const payFetch = wrapFetchWithPayment(fetch, client);
      setState("paying");
      const res = await payFetch("/api/pro-refresh", { method: "GET" });
      if (!res.ok) throw new Error(`Refresh failed (${res.status}). ${(await res.text()).slice(0, 120)}`);
      const body = (await res.json()) as { credits?: number };
      setState("done");
      setNote(`Paid ${PRICE} · ${body.credits ?? 0} Nansen credits pulled fresh`);
      void social.event("custom", `${me?.handle ?? "Someone"} paid ${PRICE} for a pro refresh on ${appName}`);
      start(() => router.push(`${pathname}?live=1&pro=1`));
    } catch (err) {
      setState("error");
      setNote(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <span className="lg-pro">
      <button type="button" className={`lg-btn lg-btn--pro${paid ? " is-paid" : ""}`} onClick={run} disabled={state === "connecting" || state === "paying"} title={`Pay ${PRICE} in USDC on ${CHAIN_NAME} over x402 for a fresh pull, bypassing the cache`}>
        <span aria-hidden="true">◈</span>{" "}
        {state === "connecting" ? "Connecting wallet…" : state === "paying" ? "Paying over x402…" : paid ? "Paid refresh" : `Pro refresh · ${PRICE}`}
      </button>
      {note ? <small className={`lg-pro__note${state === "error" ? " is-error" : ""}`}>{note}</small> : null}
    </span>
  );
}
