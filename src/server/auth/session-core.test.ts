import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import type { AuthConfig } from "./auth-config";
import { issueSessionToken, verifySessionToken } from "./session-core";

const config: AuthConfig = {
  userId: "judge-demo",
  role: "judge",
  username: "judge-demo",
  passwordHash: "unused",
  sessionSecret: "test-value-session-secret-over-32-bytes",
  secureCookie: false,
};
const now = new Date("2026-07-14T12:00:00.000Z");
const sessionId = "12345678-1234-4234-8234-123456789abc";

describe("stateless demonstration sessions", () => {
  it("issues and verifies a bounded session", async () => {
    const token = await issueSessionToken({ config, sessionId, now });
    await expect(verifySessionToken({ config, token, now })).resolves.toMatchObject({
      sub: "judge-demo",
      username: "judge-demo",
      role: "judge",
      sessionId,
    });
  });

  it("rejects expired, tampered, malformed, and missing-like tokens", async () => {
    const token = await issueSessionToken({ config, sessionId, now });
    await expect(
      verifySessionToken({ config, token, now: new Date("2026-07-15T00:01:00.000Z") }),
    ).resolves.toBeNull();
    await expect(
      verifySessionToken({ config, token: `${token.slice(0, -1)}x`, now }),
    ).resolves.toBeNull();
    await expect(verifySessionToken({ config, token: "not-a-token", now })).resolves.toBeNull();
    await expect(verifySessionToken({ config, token: "", now })).resolves.toBeNull();
  });

  it.each([
    ["wrong-issuer", "ai-orchestra-demo"],
    ["ai-orchestra", "wrong-audience"],
  ])("rejects issuer %s and audience %s", async (issuer, audience) => {
    const seconds = Math.floor(now.getTime() / 1000);
    const token = await new SignJWT({
      username: "judge-demo",
      role: "judge",
      sessionId,
      issuedAt: seconds,
      expiresAt: seconds + 28_800,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject("judge-demo")
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(seconds)
      .setExpirationTime(seconds + 28_800)
      .sign(new TextEncoder().encode(config.sessionSecret));
    await expect(verifySessionToken({ config, token, now })).resolves.toBeNull();
  });
});
