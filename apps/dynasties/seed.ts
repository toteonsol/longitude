import { runSeed } from "@longitude/kit/server";
import { buildDynasties } from "./lib/data";

await runSeed({ app: "dynasties", cap: 100, build: buildDynasties });
