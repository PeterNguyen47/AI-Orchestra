import { describe, expect, it } from "vitest";
import { parseAuthConfig } from "./auth-config";

describe("parseAuthConfig", () => {
  it("creates the fixed judge identity and environment-specific cookie policy", () => {
    expect(
      parseAuthConfig({
        DEMO_USERNAME: "judge",
        DEMO_PASSWORD_HASH: "hash",
        SESSION_SECRET: "s".repeat(32),
        NODE_ENV: "production",
      }),
    ).toMatchObject({ userId: "judge-demo", role: "judge", username: "judge", secureCookie: true });
  });

  it("rejects missing or short authentication configuration", () => {
    expect(() => parseAuthConfig({})).toThrow();
    expect(() =>
      parseAuthConfig({
        DEMO_USERNAME: "judge",
        DEMO_PASSWORD_HASH: "hash",
        SESSION_SECRET: "short",
      }),
    ).toThrow();
  });
});
