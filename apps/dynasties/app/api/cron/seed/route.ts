import { createCronSeedRoute } from "@longitude/kit/cron";
import { buildDynasties } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 800;
export const { GET } = createCronSeedRoute("dynasties", buildDynasties);
