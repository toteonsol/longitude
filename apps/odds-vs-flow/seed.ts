import { runSeed } from "@longitude/kit/server";
import { buildOddsVsFlow } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "odds-vs-flow", cap: 30, build: buildOddsVsFlow }).catch((err) => {
  console.error(err);
  process.exit(1);
});
