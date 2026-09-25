import { runSeed } from "@longitude/kit/server";
import { buildExitClock } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "exit-clock", cap: 60, build: buildExitClock }).catch((err) => {
  console.error(err);
  process.exit(1);
});
