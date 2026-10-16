import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { HttpError } from "./middleware/httpError.js";
import { logger } from "./services/logger.js";
import { authRouter } from "./routes/authRoutes.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (origin == null || env.CLIENT_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new HttpError(403, "CORS_ORIGIN_DENIED", "Origin is not allowed"));
    },
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
app.use("/api/v1/auth", authRouter);

app.use((_req, _res, next) => {
  next(new HttpError(404, "NOT_FOUND", "The requested resource was not found"));
});
app.use(errorHandler);

export { app };