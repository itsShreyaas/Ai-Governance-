/**
 * db:indexes — ensures all indexes defined in DATABASE.md exist.
 *
 * Mongoose will create indexes automatically on first query in development,
 * but this script makes index creation explicit and verifiable (e.g. in CI
 * against a staging database where auto-index-creation may be disabled).
 *
 * Run once after deployment: npm run db:indexes
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../db/connection.js";
import { User } from "../models/User.js";
import { Tool } from "../models/Tool.js";
import { Policy } from "../models/Policy.js";
import { Assessment } from "../models/Assessment.js";
import { Request } from "../models/Request.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { RefreshToken } from "../models/RefreshToken.js";

async function createIndexes() {
  await connectDB();

  console.log("🔧 Ensuring indexes...");

  const models: Array<mongoose.Model<any>> = [
    User,
    Tool,
    Policy,
    Assessment,
    Request,
    AuditEvent,
    RefreshToken,
  ];

  for (const M of models) {
    await M.createIndexes();
    console.log(`  ✓ ${M.modelName}`);
  }

  console.log("✅ All indexes ensured.");
  await disconnectDB();
}

createIndexes().catch((err) => {
  console.error("db:indexes failed:", err);
  process.exit(1);
});
