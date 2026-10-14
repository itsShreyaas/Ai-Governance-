/**
 * verify-audit — recomputes the entire hash chain and reports results.
 *
 * Exits with code 0 if the chain is intact, code 1 if any mismatch is found.
 *
 * Run: npm run verify-audit
 */

import "dotenv/config";
import { connectDB, disconnectDB } from "../db/connection.js";
import { verifyChain } from "../services/auditService.js";

async function main() {
  await connectDB();

  console.log("🔍 Verifying audit chain...");
  const result = await verifyChain();

  if (result.ok) {
    console.log(
      `✅ Chain intact — ${result.totalEvents} event(s) verified, all hashes match.`
    );
  } else {
    console.error(`❌ Chain BROKEN — ${result.error}`);
    console.error(
      `   Total events checked: ${result.totalEvents}, first bad sequence: ${result.firstBadSequence}`
    );
  }

  await disconnectDB();

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("verify-audit failed:", err);
  process.exit(1);
});
