import { runSeed } from "@longitude/kit/server";
import { buildRewind } from "./lib/data";

await runSeed({ app: "rewind", cap: 100, build: buildRewind });
