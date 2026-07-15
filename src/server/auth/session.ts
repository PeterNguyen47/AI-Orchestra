import "server-only";

import { randomUUID } from "node:crypto";

import { getAuthConfig, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./auth-config";
import {
  issueSessionToken as issueSessionTokenCore,
  verifySessionToken as verifySessionTokenCore,
  type DemoSession,
} from "./session-core";

export type { DemoSession };

export const sessionCookieOptions = Object.freeze({
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
});

export async function createSessionToken(): Promise<string> {
  return issueSessionTokenCore({ config: getAuthConfig(), sessionId: randomUUID() });
}

export async function verifySessionToken(token: string): Promise<DemoSession | null> {
  return verifySessionTokenCore({ config: getAuthConfig(), token });
}

export function getSessionCookieConfiguration() {
  return { ...sessionCookieOptions, secure: getAuthConfig().secureCookie };
}

export { SESSION_COOKIE_NAME };
