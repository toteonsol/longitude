import { createProRefreshRoute } from "@longitude/kit/pro-server";
import { buildWalletObituaries } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const { GET } = createProRefreshRoute("wallet-obituaries", buildWalletObituaries);
