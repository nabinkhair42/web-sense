import { config } from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
config();

const EnvSchema = z.object({
  GOOGLE_CSE_API_KEY: z.string().min(1),
  GOOGLE_CSE_CX: z.string().min(1),
  LMSTUDIO_BASE_URL: z.string().url().default("http://localhost:1234/v1"),
  LMSTUDIO_MODEL: z.string().min(1),
  LMSTUDIO_API_KEY: z.string().optional().default(""),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(20000),
  CONCURRENT_FETCHES: z.coerce.number().default(4),
  PER_DOC_CHAR_BUDGET: z.coerce.number().default(4000),
  TOTAL_CONTEXT_CHAR_BUDGET: z.coerce.number().default(12000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type AppEnv = z.infer<typeof EnvSchema>;
export const env: AppEnv = EnvSchema.parse(process.env);
