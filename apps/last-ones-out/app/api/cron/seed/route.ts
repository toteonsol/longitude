import { createCronSeedRoute } from "@longitude/kit/cron";
import { buildLastOnesOut } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const { GET } = createCronSeedRoute("last-ones-out", buildLastOnesOut);
