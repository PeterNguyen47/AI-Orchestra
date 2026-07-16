import { z } from "zod";

const runtimeEnvironmentSchema = z.object({
  APP_NAME: z.string().trim().min(1).max(80).default("AI Orchestra"),
  APP_VERSION: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/)
    .default("0.1.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  AI_ORCHESTRA_LIVE_EXECUTION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  AI_ORCHESTRA_RUN_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(60_000).default(30_000),
  AI_ORCHESTRA_MAX_TOTAL_TOKENS: z.coerce.number().int().min(1_000).max(25_000).default(12_000),
  AI_ORCHESTRA_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(128).max(4_096).default(2_048),
  AI_ORCHESTRA_MAX_RUN_COST_USD: z.coerce.number().min(0.01).max(1).default(0.25),
  AI_ORCHESTRA_MAX_CONCURRENT_RUNS: z.coerce.number().int().min(1).max(4).default(2),
});

export type RuntimeConfig = Readonly<{
  appName: string;
  appVersion: string;
  logLevel: "debug" | "info" | "warn" | "error";
  nodeEnvironment: "development" | "test" | "production";
  port: number;
  executionConfigured: boolean;
  liveExecutionEnabled: boolean;
  openAiApiKey?: string;
  runTimeoutMs: number;
  maximumTotalTokens: number;
  maximumOutputTokens: number;
  maximumRunCostUsd: number;
  maximumConcurrentRuns: number;
}>;

export function parseRuntimeConfig(
  source: Readonly<Record<string, string | undefined>>,
): RuntimeConfig {
  const parsed = runtimeEnvironmentSchema.parse(source);

  return Object.freeze({
    appName: parsed.APP_NAME,
    appVersion: parsed.APP_VERSION,
    logLevel: parsed.LOG_LEVEL,
    nodeEnvironment: parsed.NODE_ENV,
    port: parsed.PORT,
    executionConfigured:
      parsed.AI_ORCHESTRA_LIVE_EXECUTION_ENABLED && Boolean(parsed.OPENAI_API_KEY),
    liveExecutionEnabled: parsed.AI_ORCHESTRA_LIVE_EXECUTION_ENABLED,
    ...(parsed.OPENAI_API_KEY ? { openAiApiKey: parsed.OPENAI_API_KEY } : {}),
    runTimeoutMs: parsed.AI_ORCHESTRA_RUN_TIMEOUT_MS,
    maximumTotalTokens: parsed.AI_ORCHESTRA_MAX_TOTAL_TOKENS,
    maximumOutputTokens: parsed.AI_ORCHESTRA_MAX_OUTPUT_TOKENS,
    maximumRunCostUsd: parsed.AI_ORCHESTRA_MAX_RUN_COST_USD,
    maximumConcurrentRuns: parsed.AI_ORCHESTRA_MAX_CONCURRENT_RUNS,
  });
}
