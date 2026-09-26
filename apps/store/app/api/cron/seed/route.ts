import { APPS, appUrl } from "@longitude/kit";
import { createCronFanoutRoute } from "@longitude/kit/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 800;
export const { GET } = createCronFanoutRoute(APPS.map((a) => ({ id: a.id, url: appUrl(a.id) })));
