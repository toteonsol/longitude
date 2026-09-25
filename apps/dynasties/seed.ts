import { runSeed } from "@longitude/kit/server";
import { buildDynasties } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "dynasties", cap: 30, build: buildDynasties }).catch((err) => {
  console.error(err);
  process.exit(1);
});
