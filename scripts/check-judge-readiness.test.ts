import { describe, expect, it, vi } from "vitest";
import {
  AO011_READY_CODE,
  checkJudgeReadiness,
  main,
  type JudgeReadinessDependencies,
} from "./check-judge-readiness";
import { JUDGE_COMPLETION_MARKER_CONTENT } from "./setup-judge-auth";

const environment = { AI_ORCHESTRA_EXECUTION_MODE: "judge_fixture" };
const fixtureHash = [
  "ai-orchestra-scrypt-v1",
  "N=16384,r=8,p=1,l=32",
  Buffer.alloc(16, 1).toString("base64url"),
  Buffer.alloc(32, 2).toString("base64url"),
].join(":");
const fixtureSecret = Buffer.alloc(32, 3).toString("base64url");
const fixturePassword = Buffer.alloc(18, 4).toString("base64url");
const material = {
  marker: JUDGE_COMPLETION_MARKER_CONTENT,
  environment: [
    "DEMO_USERNAME=judge-demo",
    `DEMO_PASSWORD_HASH=${fixtureHash}`,
    `SESSION_SECRET=${fixtureSecret}`,
  ].join("\n"),
  plaintext: [
    "AI Orchestra local demonstration credentials",
    "These credentials are for local prototype use only.",
    "Username: judge-demo",
    `Password: ${fixturePassword}`,
  ].join("\n"),
};

function validFetcher(): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/api/health"))
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "AI Orchestra",
          version: "0.1.0",
          timestamp: "2026-07-21T00:00:00.000Z",
        }),
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    if (url.endsWith("/login")) return new Response("login", { status: 200 });
    return new Response(null, { status: 307, headers: { location: "/login" } });
  }) as unknown as typeof fetch;
}

function validDependencies(overrides: JudgeReadinessDependencies = {}): JudgeReadinessDependencies {
  return {
    fetcher: validFetcher(),
    credentialReader: async () => material,
    corpusLoader: async () => ["canonical-chunk"],
    passwordVerifier: async () => true,
    ...overrides,
  };
}

describe("checkJudgeReadiness", () => {
  it("returns only the fixed ready code after all checks pass", async () => {
    const fetcher = validFetcher();
    const { corpusLoader, ...dependencies } = validDependencies({ fetcher });
    expect(corpusLoader).toBeDefined();
    await expect(checkJudgeReadiness(environment, dependencies)).resolves.toBe(AO011_READY_CODE);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("maps missing or incomplete credential material to a fixed code", async () => {
    await expect(
      checkJudgeReadiness(
        environment,
        validDependencies({ credentialReader: async () => Promise.reject(new Error("missing")) }),
      ),
    ).rejects.toThrow("AO011_CREDENTIALS_INCOMPLETE");
    await expect(
      checkJudgeReadiness(
        environment,
        validDependencies({ credentialReader: async () => ({ ...material, marker: "wrong" }) }),
      ),
    ).rejects.toThrow("AO011_CREDENTIALS_INCOMPLETE");
  });

  it("rejects duplicate or internally inconsistent credentials", async () => {
    await expect(
      checkJudgeReadiness(
        environment,
        validDependencies({
          credentialReader: async () => ({
            ...material,
            environment: `${material.environment}\nDEMO_USERNAME=duplicate`,
          }),
        }),
      ),
    ).rejects.toThrow("AO011_CREDENTIALS_INVALID");
    await expect(
      checkJudgeReadiness(environment, validDependencies({ passwordVerifier: async () => false })),
    ).rejects.toThrow("AO011_CREDENTIALS_INVALID");
  });

  it("requires the explicit provider-free judge execution mode", async () => {
    await expect(
      checkJudgeReadiness({ AI_ORCHESTRA_EXECUTION_MODE: "disabled" }, validDependencies()),
    ).rejects.toThrow("AO011_MODE_INVALID");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await main();
    expect(stderr).toHaveBeenCalledWith("AO011_CREDENTIALS_INCOMPLETE\n");
    process.exitCode = undefined;
    stderr.mockRestore();
  });

  it("rejects a health response outside the four-field no-store contract", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "ok",
            service: "AI Orchestra",
            version: "0.1.0",
            timestamp: "2026-07-21T00:00:00.000Z",
            provider: "not-allowed",
          }),
          { status: 200, headers: { "cache-control": "public" } },
        ),
    ) as unknown as typeof fetch;
    await expect(checkJudgeReadiness(environment, validDependencies({ fetcher }))).rejects.toThrow(
      "AO011_HEALTH_INVALID",
    );
  });

  it("distinguishes unavailable login and invalid protected-route behavior", async () => {
    const loginUnavailable = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/login")) return new Response(null, { status: 503 });
      return validFetcher()(input);
    }) as unknown as typeof fetch;
    await expect(
      checkJudgeReadiness(environment, validDependencies({ fetcher: loginUnavailable })),
    ).rejects.toThrow("AO011_LOGIN_UNAVAILABLE");

    const unprotected = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/orchestrator")) return new Response("unexpected", { status: 200 });
      return validFetcher()(input);
    }) as unknown as typeof fetch;
    await expect(
      checkJudgeReadiness(environment, validDependencies({ fetcher: unprotected })),
    ).rejects.toThrow("AO011_PROTECTED_ROUTE_INVALID");
  });

  it("maps unavailable or empty canonical corpus data to a fixed code", async () => {
    await expect(
      checkJudgeReadiness(environment, validDependencies({ corpusLoader: async () => [] })),
    ).rejects.toThrow("AO011_CORPUS_UNAVAILABLE");
    await expect(
      checkJudgeReadiness(
        environment,
        validDependencies({ corpusLoader: async () => Promise.reject(new Error("unavailable")) }),
      ),
    ).rejects.toThrow("AO011_CORPUS_UNAVAILABLE");
  });

  it("stops bounded health polling with the fixed timeout code", async () => {
    let now = 0;
    const fetcher = vi.fn(async () =>
      Promise.reject(new Error("unavailable")),
    ) as unknown as typeof fetch;
    await expect(
      checkJudgeReadiness(
        environment,
        validDependencies({
          fetcher,
          clock: () => now,
          wait: async () => {
            now = 120_000;
          },
        }),
      ),
    ).rejects.toThrow("AO011_READINESS_TIMEOUT");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown or injected canonical environment content", async () => {
    await expect(
      checkJudgeReadiness(
        environment,
        validDependencies({
          credentialReader: async () => ({
            ...material,
            environment: `${material.environment}\nUNTRUSTED=$(touch sentinel)`,
          }),
        }),
      ),
    ).rejects.toThrow("AO011_CREDENTIALS_INVALID");
  });

  it("rejects off-origin and decorated protected-route redirects", async () => {
    for (const location of [
      "https://example.invalid/login",
      "//app:3000/login",
      "http://user:password@app:3000/login",
      "/login?next=/orchestrator",
      "/login#fragment",
    ]) {
      const fetcher = vi.fn(async (input: string | URL | Request) => {
        if (String(input).endsWith("/orchestrator"))
          return new Response(null, { status: 307, headers: { location } });
        return validFetcher()(input);
      }) as unknown as typeof fetch;
      await expect(
        checkJudgeReadiness(environment, validDependencies({ fetcher })),
      ).rejects.toThrow("AO011_PROTECTED_ROUTE_INVALID");
    }
  });
});
