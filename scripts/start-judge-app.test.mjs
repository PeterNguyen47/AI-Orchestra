import { afterEach, describe, expect, it, vi } from "vitest";

import {
  JUDGE_APP_CREDENTIAL_FAILURE_CODE,
  JUDGE_APP_MARKER_CONTENT,
  JUDGE_APP_START_FAILURE_CODE,
  loadStandaloneServer,
  main,
  parseCanonicalJudgeEnvironment,
  startJudgeApplication,
} from "./start-judge-app.mjs";

const hash = [
  "ai-orchestra-scrypt-v1",
  "N=16384,r=8,p=1,l=32",
  Buffer.alloc(16, 1).toString("base64url"),
  Buffer.alloc(32, 2).toString("base64url"),
].join(":");
const secret = Buffer.alloc(32, 3).toString("base64url");
const canonical = [
  "DEMO_USERNAME=judge-demo",
  `DEMO_PASSWORD_HASH=${hash}`,
  `SESSION_SECRET=${secret}`,
  "",
].join("\n");

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe("AO-011 judge application startup", () => {
  it("accepts the exact marker and canonical three-key document before loading the server", async () => {
    const environment = {};
    const serverLoader = vi.fn(async () => undefined);
    await startJudgeApplication({
      credentialDirectory: "/synthetic",
      environment,
      readFileImpl: async (file) =>
        String(file).endsWith("credentials.ready") ? JUDGE_APP_MARKER_CONTENT : canonical,
      serverLoader,
    });
    expect(environment).toEqual({
      DEMO_USERNAME: "judge-demo",
      DEMO_PASSWORD_HASH: hash,
      SESSION_SECRET: secret,
    });
    expect(serverLoader).toHaveBeenCalledOnce();

    const startServer = vi.fn(async () => undefined);
    const standaloneEnvironment = { PORT: "3000", HOSTNAME: "127.0.0.1" };
    await loadStandaloneServer({
      environment: standaloneEnvironment,
      readFileImpl: async () => JSON.stringify({ config: { output: "standalone" } }),
      startServerImpl: startServer,
    });
    expect(startServer).toHaveBeenCalledWith({
      dir: expect.any(String),
      isDev: false,
      config: { output: "standalone" },
      hostname: "127.0.0.1",
      port: 3000,
      allowRetry: false,
      keepAliveTimeout: undefined,
    });
  });

  it("rejects a shell-shaped unknown assignment without execution or environment mutation", async () => {
    const environment = {};
    const serverLoader = vi.fn(async () => undefined);
    await expect(
      startJudgeApplication({
        credentialDirectory: "/synthetic",
        environment,
        readFileImpl: async (file) =>
          String(file).endsWith("credentials.ready")
            ? JUDGE_APP_MARKER_CONTENT
            : `${canonical}UNTRUSTED=$(touch sentinel)\n`,
        serverLoader,
      }),
    ).rejects.toThrow(JUDGE_APP_CREDENTIAL_FAILURE_CODE);
    expect(environment).toEqual({});
    expect(serverLoader).not.toHaveBeenCalled();
  });

  it("rejects duplicate, missing, reordered, blank, and additional lines", () => {
    const lines = canonical.trimEnd().split("\n");
    for (const candidate of [
      [...lines, lines[0]].join("\n"),
      lines.slice(0, 2).join("\n"),
      [lines[1], lines[0], lines[2]].join("\n"),
      [lines[0], "", lines[1], lines[2]].join("\n"),
      `${lines.join("\n")}\nEXTRA=value`,
      `${lines.join("\n")}\n\n`,
    ]) {
      expect(() => parseCanonicalJudgeEnvironment(candidate)).toThrow(
        JUDGE_APP_CREDENTIAL_FAILURE_CODE,
      );
    }
  });

  it("rejects malformed values and emits only fixed startup failure codes", async () => {
    const lines = canonical.trimEnd().split("\n");
    for (const candidate of [
      ["DEMO_USERNAME=other", lines[1], lines[2]].join("\n"),
      [lines[0], "DEMO_PASSWORD_HASH=wrong", lines[2]].join("\n"),
      [lines[0], lines[1], "SESSION_SECRET=short"].join("\n"),
      canonical.replace("\n", "\r\n"),
      canonical.replace("judge-demo", "judge-demo\0"),
      canonical.replace("judge-demo", "judge\tdemo"),
    ]) {
      expect(() => parseCanonicalJudgeEnvironment(candidate)).toThrow(
        JUDGE_APP_CREDENTIAL_FAILURE_CODE,
      );
    }

    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await main({ readFileImpl: async () => Promise.reject(new Error("hidden")) });
    expect(stderr).toHaveBeenLastCalledWith(`${JUDGE_APP_CREDENTIAL_FAILURE_CODE}\n`);
    process.exitCode = undefined;
    await main({
      readFileImpl: async (file) =>
        String(file).endsWith("credentials.ready") ? JUDGE_APP_MARKER_CONTENT : canonical,
      serverLoader: () =>
        loadStandaloneServer({
          environment: {},
          readFileImpl: async () => JSON.stringify({ config: {} }),
          startServerImpl: async () => Promise.reject(new Error("hidden")),
        }),
    });
    expect(stderr).toHaveBeenLastCalledWith(`${JUDGE_APP_START_FAILURE_CODE}\n`);
  });
});
