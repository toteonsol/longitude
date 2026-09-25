import { createCronSeedRoute } from "@longitude/kit/cron";
import { buildRookieScout } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const { GET } = createCronSeedRoute("rookie-scout", buildRookieScout);
