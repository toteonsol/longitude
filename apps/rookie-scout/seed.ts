import { runSeed } from "@longitude/kit/server";
import { buildRookieScout } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "rookie-scout", cap: 100, build: buildRookieScout }).catch((err) => {
  console.error(err);
  process.exit(1);
});
