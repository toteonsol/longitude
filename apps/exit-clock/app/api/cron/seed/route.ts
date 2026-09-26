import { createCronSeedRoute } from "@longitude/kit/cron";
import { buildExitClock } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 800;
export const { GET } = createCronSeedRoute("exit-clock", buildExitClock);
