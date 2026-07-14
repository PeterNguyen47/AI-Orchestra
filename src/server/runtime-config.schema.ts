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
});

export type RuntimeConfig = Readonly<{
  appName: string;
  appVersion: string;
  logLevel: "debug" | "info" | "warn" | "error";
  nodeEnvironment: "development" | "test" | "production";
  port: number;
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
  });
}
