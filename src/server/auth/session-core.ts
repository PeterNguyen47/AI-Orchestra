import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

import {
  SESSION_ALGORITHM,
  SESSION_AUDIENCE,
  SESSION_ISSUER,
  SESSION_MAX_AGE_SECONDS,
  type AuthConfig,
} from "./auth-config";

const allowedClaims = new Set([
  "aud",
  "exp",
  "iat",
  "iss",
  "sub",
  "username",
  "role",
  "sessionId",
  "issuedAt",
  "expiresAt",
]);

const sessionPayloadSchema = z.object({
  sub: z.literal("judge-demo"),
  username: z.string().min(1).max(80),
  role: z.literal("judge"),
  sessionId: z.string().uuid(),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  iss: z.literal(SESSION_ISSUER),
  aud: z.union([z.literal(SESSION_AUDIENCE), z.array(z.literal(SESSION_AUDIENCE)).length(1)]),
});

export type DemoSession = Readonly<{
  sub: "judge-demo";
  username: string;
  role: "judge";
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
}>;

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function issueSessionToken(input: {
  config: AuthConfig;
  sessionId: string;
  now?: Date;
}): Promise<string> {
  const issuedAt = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const expiresAt = issuedAt + SESSION_MAX_AGE_SECONDS;

  return new SignJWT({
    username: input.config.username,
    role: input.config.role,
    sessionId: input.sessionId,
    issuedAt,
    expiresAt,
  })
    .setProtectedHeader({ alg: SESSION_ALGORITHM, typ: "JWT" })
    .setSubject(input.config.userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secretKey(input.config.sessionSecret));
}

export async function verifySessionToken(input: {
  config: AuthConfig;
  token: string;
  now?: Date;
}): Promise<DemoSession | null> {
  try {
    const verificationOptions = {
      algorithms: [SESSION_ALGORITHM],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      ...(input.now ? { currentDate: input.now } : {}),
    };
    const { payload, protectedHeader } = await jwtVerify(
      input.token,
      secretKey(input.config.sessionSecret),
      verificationOptions,
    );

    if (
      protectedHeader.alg !== SESSION_ALGORITHM ||
      Object.keys(payload).some((claim) => !allowedClaims.has(claim))
    ) {
      return null;
    }

    const parsed = sessionPayloadSchema.safeParse(payload);
    if (!parsed.success) return null;

    const value = parsed.data;
    if (
      value.username !== input.config.username ||
      value.iat !== value.issuedAt ||
      value.exp !== value.expiresAt ||
      value.expiresAt - value.issuedAt !== SESSION_MAX_AGE_SECONDS
    ) {
      return null;
    }

    return {
      sub: value.sub,
      username: value.username,
      role: value.role,
      sessionId: value.sessionId,
      issuedAt: value.issuedAt,
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}
