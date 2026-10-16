import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../services/logger.js";

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  await mongoose.connect(env.MONGODB_URI, {
    // strict mode is set per-schema; connection-level default is fine
  });

  isConnected = true;
  logger.info("Connected to MongoDB");
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info("Disconnected from MongoDB");
}
