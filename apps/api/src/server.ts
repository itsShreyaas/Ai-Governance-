import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./db/connection.js";
import { logger } from "./services/logger.js";

try {
  await connectDB();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "AegisAI API listening");
  });

  const shutdown = (): void => {
    server.close(() => {
      void disconnectDB().finally(() => process.exit(0));
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error: unknown) {
  logger.fatal({ error }, "API startup failed");
  process.exitCode = 1;
}