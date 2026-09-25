import { runSeed } from "@longitude/kit/server";
import { buildLastOnesOut } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "last-ones-out", cap: 40, build: buildLastOnesOut }).catch((err) => {
  console.error(err);
  process.exit(1);
});
