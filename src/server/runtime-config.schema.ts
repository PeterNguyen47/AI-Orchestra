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
  AI_ORCHESTRA_EXECUTION_MODE: z.enum(["disabled", "ollama_local", "judge_fixture"]).optional(),
  AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OLLAMA_BASE_URL: z.string().trim().default("http://127.0.0.1:11434"),
  AI_ORCHESTRA_LOCAL_MODEL: z.literal("qwen3:4b").default("qwen3:4b"),
  AI_ORCHESTRA_LOCAL_TIMEOUT_MS: z.coerce.number().int().min(15_000).max(180_000).default(120_000),
  AI_ORCHESTRA_LOCAL_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(128).max(2_048).default(1_024),
  AI_ORCHESTRA_OPENAI_EXECUTION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  AI_ORCHESTRA_MAX_TOTAL_TOKENS: z.coerce.number().int().min(1_000).max(25_000).default(12_000),
  AI_ORCHESTRA_MAX_CONCURRENT_RUNS: z.coerce.number().int().min(1).max(4).default(2),
});

export type RuntimeConfig = Readonly<{
  appName: string;
  appVersion: string;
  logLevel: "debug" | "info" | "warn" | "error";
  nodeEnvironment: "development" | "test" | "production";
  port: number;
  executionMode: "disabled" | "ollama_local" | "judge_fixture";
  executionConfigured: boolean;
  localExecutionEnabled: boolean;
  judgeFixtureEnabled: boolean;
  ollamaBaseUrl: string;
  localModel: "qwen3:4b";
  localTimeoutMs: number;
  localMaximumOutputTokens: number;
  optionalOpenAiConfigured: boolean;
  openAiApiKey?: string;
  maximumTotalTokens: number;
  maximumConcurrentRuns: number;
}>;

export function parseLoopbackHttpUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("OLLAMA_BASE_URL_INVALID");
  }
  const allowedHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    url.protocol !== "http:" ||
    !allowedHostnames.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "" && url.pathname !== "/")
  ) {
    throw new Error("OLLAMA_BASE_URL_INVALID");
  }
  return url.origin;
}

export function parseRuntimeConfig(
  source: Readonly<Record<string, string | undefined>>,
): RuntimeConfig {
  const parsed = runtimeEnvironmentSchema.parse(source);
  const executionMode =
    parsed.AI_ORCHESTRA_EXECUTION_MODE ??
    (parsed.AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED ? "ollama_local" : "disabled");
  if (
    (executionMode === "judge_fixture" &&
      (parsed.AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED ||
        parsed.AI_ORCHESTRA_OPENAI_EXECUTION_ENABLED)) ||
    (executionMode === "disabled" && parsed.AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED)
  ) {
    throw new Error("EXECUTION_MODE_CONFLICT");
  }
  const localExecutionEnabled = executionMode === "ollama_local";
  const judgeFixtureEnabled = executionMode === "judge_fixture";
  return Object.freeze({
    appName: parsed.APP_NAME,
    appVersion: parsed.APP_VERSION,
    logLevel: parsed.LOG_LEVEL,
    nodeEnvironment: parsed.NODE_ENV,
    port: parsed.PORT,
    executionMode,
    executionConfigured: localExecutionEnabled || judgeFixtureEnabled,
    localExecutionEnabled,
    judgeFixtureEnabled,
    ollamaBaseUrl: localExecutionEnabled
      ? parseLoopbackHttpUrl(parsed.OLLAMA_BASE_URL)
      : "http://127.0.0.1:11434",
    localModel: parsed.AI_ORCHESTRA_LOCAL_MODEL,
    localTimeoutMs: parsed.AI_ORCHESTRA_LOCAL_TIMEOUT_MS,
    localMaximumOutputTokens: parsed.AI_ORCHESTRA_LOCAL_MAX_OUTPUT_TOKENS,
    optionalOpenAiConfigured:
      parsed.AI_ORCHESTRA_OPENAI_EXECUTION_ENABLED && Boolean(parsed.OPENAI_API_KEY),
    ...(parsed.OPENAI_API_KEY ? { openAiApiKey: parsed.OPENAI_API_KEY } : {}),
    maximumTotalTokens: parsed.AI_ORCHESTRA_MAX_TOTAL_TOKENS,
    maximumConcurrentRuns: parsed.AI_ORCHESTRA_MAX_CONCURRENT_RUNS,
  });
}
