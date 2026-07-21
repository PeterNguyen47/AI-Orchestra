import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";

import {
  E2E_FIXTURE_LOOPBACK_HOST as LOOPBACK_HOST,
  startE2EFixture,
  stopE2EFixture,
  type E2EFixture as Fixture,
} from "./e2e-fixture-boundary";

const APP_PORT = 3000;
const GOVERNED_MARKER = "@ao00(8|9)";
const SENSITIVE_SENTINELS = ["AO008-SENSITIVE-SENTINEL", "AO008-FIXTURE-ANSWER-SENTINEL"] as const;
const authenticationKeys = new Set(["DEMO_USERNAME", "DEMO_PASSWORD_HASH", "SESSION_SECRET"]);
const providerEnvironmentKeys = [
  "AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED",
  "OLLAMA_BASE_URL",
  "AI_ORCHESTRA_LOCAL_MODEL",
  "AI_ORCHESTRA_LOCAL_TIMEOUT_MS",
  "AI_ORCHESTRA_LOCAL_MAX_OUTPUT_TOKENS",
  "AI_ORCHESTRA_OPENAI_EXECUTION_ENABLED",
  "RUN_LIVE_OPENAI_TESTS",
  "OPENAI_API_KEY",
] as const;

type CapturedApplication = Readonly<{
  child: ChildProcess;
  governedLogRecords: string[];
}>;

function loadLocalAuthentication(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of providerEnvironmentKeys) delete environment[key];
  if (!existsSync(".env.local")) return environment;

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    if (authenticationKeys.has(key) && environment[key] === undefined) {
      environment[key] = line.slice(separator + 1);
    }
  }
  return environment;
}

function waitForExit(child: ChildProcess): Promise<number> {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForHealth(server: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error("The browser-test server exited early.");
    try {
      const response = await fetch(`http://${LOOPBACK_HOST}:${APP_PORT}/api/health`);
      if (response.ok) return;
    } catch {
      // The bounded startup poll is expected to fail until the server is listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The browser-test server did not become healthy.");
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null) return;
  const exited = waitForExit(server);
  server.kill("SIGTERM");
  const stoppedGracefully = await Promise.race([
    exited.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!stoppedGracefully && server.exitCode === null) {
    server.kill("SIGKILL");
    await exited;
  }
}

function canBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, LOOPBACK_HOST, () => {
      probe.close(() => resolve(true));
    });
  });
}

async function requirePortReleased(port: number): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await canBind(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Required loopback port ${port} was not released.`);
}

async function stopResourcesAndReleasePorts(
  stopOperations: ReadonlyArray<Promise<void>>,
  ports: ReadonlyArray<number>,
): Promise<void> {
  const stopResults = await Promise.allSettled(stopOperations);
  const releaseResults = await Promise.allSettled(ports.map(requirePortReleased));
  const failure = [...stopResults, ...releaseResults].find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) throw failure.reason;
}

function startApplication(
  environment: NodeJS.ProcessEnv,
  captureGovernedLogs: boolean,
): CapturedApplication {
  const governedLogRecords: string[] = [];
  const child = spawn(process.execPath, [".next/standalone/server.js"], {
    env: {
      ...environment,
      ...(captureGovernedLogs ? { LOG_LEVEL: "info" } : {}),
      HOSTNAME: LOOPBACK_HOST,
      PORT: String(APP_PORT),
    },
    stdio: captureGovernedLogs ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (captureGovernedLogs) {
    let pending = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      pending += chunk.toString("utf8");
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as { event?: unknown };
          if (parsed.event === "governed_rag_run") governedLogRecords.push(JSON.stringify(parsed));
        } catch {
          // Only structured governed-run records are retained for redaction assertions.
        }
      }
    });
    child.stderr?.resume();
  }

  return { child, governedLogRecords };
}

async function runPlaywright(
  environment: NodeJS.ProcessEnv,
  grepFlag: "--grep" | "--grep-invert",
  outputDirectory: "test-results/playwright/baseline" | "test-results/playwright/governed",
): Promise<void> {
  const playwright = spawn(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      grepFlag,
      GOVERNED_MARKER,
      "--output",
      outputDirectory,
    ],
    {
      env: { ...environment, PLAYWRIGHT_EXTERNAL_SERVER: "1" },
      stdio: "inherit",
    },
  );
  const exitCode = await waitForExit(playwright);
  if (exitCode !== 0) throw new Error(`Chromium suite failed with exit code ${exitCode}.`);
}

function requireSafeFixtureEvidence(
  fixture: Fixture,
  governedLogRecords: ReadonlyArray<string>,
): void {
  if (
    fixture.counts.tags !== 1 ||
    fixture.counts.version !== 1 ||
    fixture.counts.chat !== 1 ||
    fixture.counts.unexpected !== 0
  ) {
    throw new Error("The AO-008 fixture endpoint-count contract failed.");
  }
  if (governedLogRecords.length !== 2)
    throw new Error("Expected two structured governed-run log records.");
  const serialized = governedLogRecords.join("\n");
  if (SENSITIVE_SENTINELS.some((sentinel) => serialized.includes(sentinel)))
    throw new Error("Sensitive sentinel content entered structured run logs.");
}

async function runOriginalScenarios(environment: NodeJS.ProcessEnv): Promise<void> {
  await requirePortReleased(APP_PORT);
  let application: CapturedApplication | undefined;
  try {
    application = startApplication(environment, false);
    await waitForHealth(application.child);
    await runPlaywright(environment, "--grep-invert", "test-results/playwright/baseline");
  } finally {
    await stopResourcesAndReleasePorts(application ? [stopServer(application.child)] : [], [
      APP_PORT,
    ]);
  }
}

async function runGovernedScenarios(environment: NodeJS.ProcessEnv): Promise<void> {
  const fixture = await startE2EFixture();
  const enabledEnvironment: NodeJS.ProcessEnv = {
    ...environment,
    AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED: "true",
    OLLAMA_BASE_URL: `http://${LOOPBACK_HOST}:${fixture.port}`,
    AI_ORCHESTRA_LOCAL_MODEL: "qwen3:4b",
    AI_ORCHESTRA_LOCAL_TIMEOUT_MS: "15000",
    AI_ORCHESTRA_LOCAL_MAX_OUTPUT_TOKENS: "256",
  };
  let application: CapturedApplication | undefined;
  try {
    application = startApplication(enabledEnvironment, true);
    await waitForHealth(application.child);
    await runPlaywright(enabledEnvironment, "--grep", "test-results/playwright/governed");
    requireSafeFixtureEvidence(fixture, application.governedLogRecords);
  } finally {
    await stopResourcesAndReleasePorts(
      [...(application ? [stopServer(application.child)] : []), stopE2EFixture(fixture)],
      [APP_PORT, fixture.port],
    );
  }
  process.stdout.write(
    `AO-008/AO-009 fixture counts: tags=${fixture.counts.tags}, version=${fixture.counts.version}, chat=${fixture.counts.chat}, unexpected=${fixture.counts.unexpected}.\n`,
  );
}

async function main(): Promise<void> {
  const environment = loadLocalAuthentication();
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  await runOriginalScenarios(environment);
  await runGovernedScenarios(environment);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Browser tests failed."}\n`);
  process.exitCode = 1;
});
