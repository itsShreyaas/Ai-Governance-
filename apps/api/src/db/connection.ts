import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/aegisai?replicaSet=rs0";

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  await mongoose.connect(MONGODB_URI, {
    // strict mode is set per-schema; connection-level default is fine
  });

  isConnected = true;
  console.log(`[DB] Connected to MongoDB: ${MONGODB_URI}`);
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log("[DB] Disconnected from MongoDB");
}

// Graceful shutdown on SIGINT / SIGTERM
process.on("SIGINT", () => disconnectDB().then(() => process.exit(0)));
process.on("SIGTERM", () => disconnectDB().then(() => process.exit(0)));
