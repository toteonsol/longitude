import { createProRefreshRoute } from "@longitude/kit/pro-server";
import { buildMenagerie } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const { GET } = createProRefreshRoute("menagerie", buildMenagerie);
