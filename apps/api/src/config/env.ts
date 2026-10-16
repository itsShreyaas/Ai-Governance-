import "dotenv/config";
import { z } from "zod";

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.preprocess(
      (value) => value === "" ? undefined : value,
      z.enum(["development", "test", "production"]).default("development")
    ),
    PORT: z.preprocess(
      (value) => value === "" ? undefined : value,
      z.coerce.number().int().min(1).max(65535).default(3000)
    ),
    MONGODB_URI: z.string().min(1).refine((value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://")),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    CLIENT_ORIGIN: z.string().min(1),
  })
  .refine((value) => value.JWT_ACCESS_SECRET !== value.JWT_REFRESH_SECRET, {
    message: "JWT secrets must be different",
    path: ["JWT_REFRESH_SECRET"],
  });

const parsedEnvironment = EnvironmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnvironment.error.message}`);
}

export const env = {
  ...parsedEnvironment.data,
  CLIENT_ORIGINS: parsedEnvironment.data.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
};

export type Environment = typeof env;