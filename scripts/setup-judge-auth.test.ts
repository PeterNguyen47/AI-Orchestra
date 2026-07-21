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
  parseJudgeAuthArguments,
  setupJudgeAuthentication,
} from "./setup-judge-auth";

let directory = "";
const originalDirectory = process.env.AI_ORCHESTRA_JUDGE_CREDENTIAL_DIRECTORY;

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
  password = ["judge", "password"].join("-"),
) {
  await writeFile(
    options.envFile,
    [
      "DEMO_USERNAME=judge-demo",
      `DEMO_PASSWORD_HASH=${["fixture", "hash"].join("-")}`,
      `SESSION_SECRET=${"s".repeat(40)}`,
      "",
    ].join("\n"),
  );
  await writeFile(
    options.credentialsFile,
    ["Username: judge-demo", `Password: ${password}`, ""].join("\n"),
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
      return writeFixture(options, ["rotated", "password"].join("-"));
    });
    const result = await setupJudgeAuthentication(["--force"], environment(), {
      setupAuthentication: setup,
      verify: async (password) => password.startsWith("rotated-"),
    });
    expect(result.password).toBe(["rotated", "password"].join("-"));
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
          "DEMO_USERNAME=judge-demo",
          "DEMO_USERNAME=duplicate",
          `DEMO_PASSWORD_HASH=${["fixture", "hash"].join("-")}`,
          `SESSION_SECRET=${"s".repeat(40)}`,
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
  });

  it("prints only the fixed success code in quiet direct-execution mode", async () => {
    process.env.AI_ORCHESTRA_JUDGE_CREDENTIAL_DIRECTORY = directory;
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await main(["--quiet"]);
    expect(stdout).toHaveBeenCalledWith(`${JUDGE_AUTH_SUCCESS_CODE}\n`);
    expect(stderr).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });
});
