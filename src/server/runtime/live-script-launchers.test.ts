import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const localReceipt = join(repositoryRoot, "test-results", "ao007-local-model-receipt.json");
const openAiReceipt = join(repositoryRoot, "test-results", "ao007-openai-live-receipt.json");
const localScriptSource = readFileSync(
  join(repositoryRoot, "scripts", "run-live-ao007.ts"),
  "utf8",
);
const replacementQuestion =
  "What controls protect input, retrieval, model output, citations, credentials, and logs?";
const importProbe =
  "await Promise.all([import('./src/server/runtime/executor.ts'), import('./src/server/runtime/ollama-local-adapter.ts')])";
type EnvironmentOverrides = Readonly<Record<string, string | undefined>>;

function receiptState(path: string): string {
  if (!existsSync(path)) return "absent";
  const stat = statSync(path);
  return `${stat.size}:${stat.mtimeMs}`;
}

function controlledEnvironment(overrides: EnvironmentOverrides): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete environment[key];
    } else {
      environment[key] = value;
    }
  }
  environment.NODE_ENV = "test";
  environment.CI = "true";
  environment.FORCE_COLOR = "0";
  environment.NO_COLOR = "1";
  return environment;
}

function launch(script: string, environment: NodeJS.ProcessEnv) {
  return spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", join(repositoryRoot, "scripts", script)],
    {
      cwd: repositoryRoot,
      env: environment,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 64 * 1024,
      shell: false,
      windowsHide: true,
    },
  );
}

function expectSanitizedGateFailure(result: ReturnType<typeof launch>, expectedCode: string): void {
  expect(result.error).toBeUndefined();
  expect(result.status).not.toBe(0);
  expect(result.stdout).toBe("");
  expect(result.stderr.trim()).toBe(expectedCode);
  const output = `${result.stdout}\n${result.stderr}`;
  expect(output).not.toMatch(/top-level await.*not supported.*cjs/i);
  expect(output).not.toMatch(/transform failed/i);
  expect(output).not.toMatch(/\bat .+\(.+:\d+:\d+\)/);
  expect(output).not.toContain("Error:");
  expect(output).not.toContain("What controls keep the AI Orchestra Enterprise RAG run governed?");
  expect(output).not.toContain(replacementQuestion);
  expect(output).not.toContain("answerMarkdown");
  expect(output).not.toContain("untrustedContext");
  expect(output).not.toContain("OPENAI_API_KEY");
  expect(output).not.toContain("[object Object]");
}

describe("AO-007 live-script launchers", () => {
  it("pins the local smoke question and preserves safe generation-count precedence", () => {
    const greaterThanOneGuard = localScriptSource.indexOf("if (generationRequests > 1)");
    const nonCompletedGuard = localScriptSource.indexOf('if (result.status !== "completed")');
    const completedCountGuard = localScriptSource.indexOf("if (generationRequests !== 1)");

    expect(localScriptSource).toContain(`"${replacementQuestion}"`);
    expect(greaterThanOneGuard).toBeGreaterThan(-1);
    expect(nonCompletedGuard).toBeGreaterThan(greaterThanOneGuard);
    expect(completedCountGuard).toBeGreaterThan(nonCompletedGuard);
    expect(localScriptSource).toContain('model: z.literal("qwen3:4b")');
    expect(localScriptSource).toContain("test-results/ao007-local-model-receipt.json");
  });

  it("imports server-only runtime modules through the react-server condition without providers", () => {
    const localReceiptBefore = receiptState(localReceipt);
    const openAiReceiptBefore = receiptState(openAiReceipt);
    const result = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        importProbe,
      ],
      {
        cwd: repositoryRoot,
        env: controlledEnvironment({ OPENAI_API_KEY: undefined }),
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 64 * 1024,
        shell: false,
        windowsHide: true,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(receiptState(localReceipt)).toBe(localReceiptBefore);
    expect(receiptState(openAiReceipt)).toBe(openAiReceiptBefore);
  });

  it("launches the local script through tsx and reaches its disabled gate", () => {
    const localReceiptBefore = receiptState(localReceipt);
    const openAiReceiptBefore = receiptState(openAiReceipt);
    const result = launch(
      "run-live-ao007.ts",
      controlledEnvironment({
        AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED: "false",
        AI_ORCHESTRA_OPENAI_EXECUTION_ENABLED: "false",
        RUN_LIVE_OPENAI_TESTS: "false",
        OPENAI_API_KEY: undefined,
      }),
    );

    expectSanitizedGateFailure(result, "LOCAL_GATE_DISABLED");
    expect(receiptState(localReceipt)).toBe(localReceiptBefore);
    expect(receiptState(openAiReceipt)).toBe(openAiReceiptBefore);
  });

  it("launches the optional OpenAI script through tsx and reaches its disabled gate", () => {
    const localReceiptBefore = receiptState(localReceipt);
    const openAiReceiptBefore = receiptState(openAiReceipt);
    const result = launch(
      "run-live-ao007-openai.ts",
      controlledEnvironment({
        AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED: "false",
        AI_ORCHESTRA_OPENAI_EXECUTION_ENABLED: "false",
        RUN_LIVE_OPENAI_TESTS: "false",
        OPENAI_API_KEY: undefined,
      }),
    );

    expectSanitizedGateFailure(result, "LIVE_GATE_DISABLED");
    expect(receiptState(localReceipt)).toBe(localReceiptBefore);
    expect(receiptState(openAiReceipt)).toBe(openAiReceiptBefore);
  });
});
