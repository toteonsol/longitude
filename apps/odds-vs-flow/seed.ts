import { runSeed } from "@longitude/kit/server";
import { buildOddsVsFlow } from "./lib/data";

await runSeed({ app: "odds-vs-flow", cap: 100, build: buildOddsVsFlow });
