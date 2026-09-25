import { runSeed } from "@longitude/kit/server";
import { buildRewind } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "rewind", cap: 100, build: buildRewind }).catch((err) => {
  console.error(err);
  process.exit(1);
});
