import "server-only";

import { z } from "zod";

export const SESSION_COOKIE_NAME = "ai_orchestra_session";
export const SESSION_ISSUER = "ai-orchestra";
export const SESSION_AUDIENCE = "ai-orchestra-demo";
export const SESSION_ALGORITHM = "HS256";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const authEnvironmentSchema = z.object({
  DEMO_USERNAME: z.string().trim().min(1).max(80),
  DEMO_PASSWORD_HASH: z.string().trim().min(1).max(512),
  SESSION_SECRET: z
    .string()
    .refine((value) => Buffer.byteLength(value, "utf8") >= 32, "Session secret is too short."),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AuthConfig = Readonly<{
  userId: "judge-demo";
  role: "judge";
  username: string;
  passwordHash: string;
  sessionSecret: string;
  secureCookie: boolean;
}>;

export function parseAuthConfig(source: Readonly<Record<string, string | undefined>>): AuthConfig {
  const parsed = authEnvironmentSchema.parse(source);

  return Object.freeze({
    userId: "judge-demo",
    role: "judge",
    username: parsed.DEMO_USERNAME,
    passwordHash: parsed.DEMO_PASSWORD_HASH,
    sessionSecret: parsed.SESSION_SECRET,
    secureCookie: parsed.NODE_ENV === "production",
  });
}

export function getAuthConfig(): AuthConfig {
  return parseAuthConfig(process.env);
}
