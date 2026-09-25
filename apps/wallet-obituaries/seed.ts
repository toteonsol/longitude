import { runSeed } from "@longitude/kit/server";
import { buildWalletObituaries } from "./lib/data";

await runSeed({ app: "wallet-obituaries", cap: 100, build: buildWalletObituaries });
