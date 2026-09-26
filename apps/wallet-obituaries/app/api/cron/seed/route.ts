import { createCronSeedRoute } from "@longitude/kit/cron";
import { buildWalletObituaries } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 800;
export const { GET } = createCronSeedRoute("wallet-obituaries", buildWalletObituaries);
