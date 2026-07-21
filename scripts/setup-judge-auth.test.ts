import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JUDGE_AUTH_SUCCESS_CODE,
  JUDGE_COMPLETION_MARKER,
  JUDGE_COMPLETION_MARKER_CONTENT,
  JUDGE_ENV_FILE,
  JUDGE_PLAINTEXT_FILE,
  main,
  parseCanonicalJudgeEnvironment,
  parseJudgeAuthArguments,
  setupJudgeAuthentication,
} from "./setup-judge-auth";

let directory = "";
const originalDirectory = process.env.AI_ORCHESTRA_JUDGE_CREDENTIAL_DIRECTORY;
const fixtureHash = [
  "ai-orchestra-scrypt-v1",
  "N=16384,r=8,p=1,l=32",
  Buffer.alloc(16, 1).toString("base64url"),
  Buffer.alloc(32, 2).toString("base64url"),
].join(":");
const fixtureSecret = Buffer.alloc(32, 3).toString("base64url");
const fixturePassword = Buffer.alloc(18, 4).toString("base64url");
const rotatedPassword = Buffer.alloc(18, 5).toString("base64url");

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "ao011-auth-"));
});

afterEach(async () => {
  if (originalDirectory === undefined) delete process.env.AI_ORCHESTRA_JUDGE_CREDENTIAL_DIRECTORY;
  else process.env.AI_ORCHESTRA_JUDGE_CREDENTIAL_DIRECTORY = originalDirectory;
  process.exitCode = undefined;
  await rm(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function writeFixture(
  options: { envFile: string; credentialsFile: string },
  password = fixturePassword,
) {
  await writeFile(
    options.envFile,
    [
      "# Local demonstration authentication only.",
      "DEMO_USERNAME=judge-demo",
      `DEMO_PASSWORD_HASH=${fixtureHash}`,
      `SESSION_SECRET=${fixtureSecret}`,
      "",
    ].join("\n"),
  );
  await writeFile(
    options.credentialsFile,
    [
      "AI Orchestra local demonstration credentials",
      "These credentials are for local prototype use only.",
      "Username: judge-demo",
      `Password: ${password}`,
      "",
    ].join("\n"),
  );
  return { username: "judge-demo" as const, password };
}

const environment = () => ({ AI_ORCHESTRA_JUDGE_CREDENTIAL_DIRECTORY: directory });

describe("setupJudgeAuthentication", () => {
  it("accepts only the supported bounded flags", () => {
    expect(parseJudgeAuthArguments(["--force", "--quiet"])).toEqual({
      force: true,
      quiet: true,
    });
  });

  it("rejects unknown arguments with a fixed code", () => {
    expect(() => parseJudgeAuthArguments(["--unknown"])).toThrow("AO011_AUTH_ARGUMENT_INVALID");
  });

  it("writes verified credential files before the fixed completion marker", async () => {
    const marker = path.join(directory, JUDGE_COMPLETION_MARKER);
    const setup = vi.fn(async (options: { envFile: string; credentialsFile: string }) => {
      await expect(readFile(marker, "utf8")).rejects.toThrow();
      return writeFixture(options);
    });
    const result = await setupJudgeAuthentication([], environment(), {
      setupAuthentication: setup,
      verify: async () => true,
    });
    expect(result).toMatchObject({ username: "judge-demo", quiet: false });
    expect(await readFile(marker, "utf8")).toBe(JUDGE_COMPLETION_MARKER_CONTENT);
  });

  it("refuses any existing authentication state without force", async () => {
    await writeFile(path.join(directory, JUDGE_ENV_FILE), "existing");
    const setup = vi.fn();
    await expect(
      setupJudgeAuthentication([], environment(), { setupAuthentication: setup }),
    ).rejects.toThrow("AO011_AUTH_EXISTS");
    expect(setup).not.toHaveBeenCalled();
  });

  it("rotates the password, hash, and session secret together when forced", async () => {
    await writeFile(path.join(directory, JUDGE_ENV_FILE), "old-environment");
    await writeFile(path.join(directory, JUDGE_PLAINTEXT_FILE), "old-credential");
    await writeFile(path.join(directory, JUDGE_COMPLETION_MARKER), "old-marker");
    const setup = vi.fn(async (options: { envFile: string; credentialsFile: string }) => {
      await expect(
        readFile(path.join(directory, JUDGE_COMPLETION_MARKER), "utf8"),
      ).rejects.toThrow();
      return writeFixture(options, rotatedPassword);
    });
    const result = await setupJudgeAuthentication(["--force"], environment(), {
      setupAuthentication: setup,
      verify: async (password) => password === rotatedPassword,
    });
    expect(result.password).toBe(rotatedPassword);
    expect(await readFile(path.join(directory, JUDGE_ENV_FILE), "utf8")).toContain(
      "SESSION_SECRET=",
    );
    expect(await readFile(path.join(directory, JUDGE_COMPLETION_MARKER), "utf8")).toBe(
      JUDGE_COMPLETION_MARKER_CONTENT,
    );
  });

  it("fails closed when generated files are incomplete", async () => {
    const setup = async (options: { envFile: string }) => {
      await writeFile(options.envFile, "DEMO_USERNAME=judge-demo\n");
      return { username: "judge-demo" as const, password: "synthetic" };
    };
    await expect(
      setupJudgeAuthentication([], environment(), {
        setupAuthentication: setup as never,
        verify: async () => true,
      }),
    ).rejects.toThrow("AO011_AUTH_VERIFICATION_FAILED");
    await expect(readFile(path.join(directory, JUDGE_COMPLETION_MARKER), "utf8")).rejects.toThrow();
  });

  it("rejects duplicate or internally inconsistent generated values", async () => {
    const setup = async (options: { envFile: string; credentialsFile: string }) => {
      await writeFixture(options);
      await writeFile(
        options.envFile,
        [
          "# Local demonstration authentication only.",
          "DEMO_USERNAME=judge-demo",
          "DEMO_USERNAME=duplicate",
          `DEMO_PASSWORD_HASH=${fixtureHash}`,
          `SESSION_SECRET=${fixtureSecret}`,
        ].join("\n"),
      );
      return { username: "judge-demo" as const, password: "synthetic" };
    };
    await expect(
      setupJudgeAuthentication([], environment(), {
        setupAuthentication: setup as never,
        verify: async () => false,
      }),
    ).rejects.toThrow("AO011_AUTH_VERIFICATION_FAILED");
    await expect(
      setupJudgeAuthentication(["--force"], environment(), {
        setupAuthentication: writeFixture,
        verify: async () => false,
      }),
    ).rejects.toThrow("AO011_AUTH_VERIFICATION_FAILED");
  });

  it("emits only fixed direct-execution success and failure codes", async () => {
    process.env.AI_ORCHESTRA_JUDGE_CREDENTIAL_DIRECTORY = directory;
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await main(["--quiet"]);
    expect(stdout).toHaveBeenCalledWith(`${JUDGE_AUTH_SUCCESS_CODE}\n`);
    expect(stderr).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    await main(["--unknown"]);
    expect(stderr).toHaveBeenCalledWith("AO011_AUTH_ARGUMENT_INVALID\n");
    expect(process.exitCode).toBe(1);
  });

  it("discards stale unknown and shell-shaped content during forced rotation", async () => {
    const envFile = path.join(directory, JUDGE_ENV_FILE);
    const credentialsFile = path.join(directory, JUDGE_PLAINTEXT_FILE);
    await writeFile(envFile, "UNTRUSTED=$(touch sentinel)\nSTALE=value\n");
    await writeFile(credentialsFile, "stale");
    await writeFile(path.join(directory, JUDGE_COMPLETION_MARKER), "stale");
    const setup = vi.fn(async (options: { envFile: string; credentialsFile: string }) => {
      await expect(readFile(options.envFile, "utf8")).rejects.toThrow();
      await expect(readFile(options.credentialsFile, "utf8")).rejects.toThrow();
      return writeFixture(options, rotatedPassword);
    });
    await setupJudgeAuthentication(["--force"], environment(), {
      setupAuthentication: setup,
      verify: async () => true,
    });
    const canonical = await readFile(envFile, "utf8");
    expect(() => parseCanonicalJudgeEnvironment(canonical)).not.toThrow();
    expect(canonical).not.toMatch(/UNTRUSTED|STALE|touch/);
  });

  it("rejects an unexpected intermediate line and leaves the marker absent", async () => {
    const setup = async (options: { envFile: string; credentialsFile: string }) => {
      const result = await writeFixture(options);
      await writeFile(options.envFile, `${await readFile(options.envFile, "utf8")}EXTRA=value\n`);
      return result;
    };
    await expect(
      setupJudgeAuthentication([], environment(), {
        setupAuthentication: setup,
        verify: async () => true,
      }),
    ).rejects.toThrow("AO011_AUTH_VERIFICATION_FAILED");
    await expect(readFile(path.join(directory, JUDGE_COMPLETION_MARKER), "utf8")).rejects.toThrow();
  });

  it("writes exactly three canonical environment lines before validating the marker", async () => {
    await setupJudgeAuthentication([], environment(), {
      setupAuthentication: writeFixture,
      verify: async () => true,
    });
    expect(await readFile(path.join(directory, JUDGE_ENV_FILE), "utf8")).toBe(
      [
        "DEMO_USERNAME=judge-demo",
        `DEMO_PASSWORD_HASH=${fixtureHash}`,
        `SESSION_SECRET=${fixtureSecret}`,
        "",
      ].join("\n"),
    );
    expect(await readFile(path.join(directory, JUDGE_COMPLETION_MARKER), "utf8")).toBe(
      JUDGE_COMPLETION_MARKER_CONTENT,
    );
  });
});
