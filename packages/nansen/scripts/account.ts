// Smoke test: prints plan and remaining credits. Costs 0 credits.
//   node --env-file-if-exists=.env --import tsx packages/nansen/scripts/account.ts
import { NansenConfigError, createNansen } from "../src";

const nansen = createNansen({ script: "smoke:account", cache: false, logToConsole: true });
try {
  const account = await nansen.account();
  console.log(JSON.stringify(account, null, 2));
  console.log(`cap for this process: ${nansen.credits.cap ?? "none"} | spent: ${nansen.credits.spent}`);
} catch (err) {
  if (err instanceof NansenConfigError) {
    console.error(err.message);
    process.exit(2);
  }
  throw err;
} finally {
  await nansen.log.flush();
}
