import { runSeed } from "@longitude/kit/server";
import { buildWalletObituaries } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "wallet-obituaries", cap: 100, build: buildWalletObituaries }).catch((err) => {
  console.error(err);
  process.exit(1);
});
