import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";

const authenticationKeys = new Set(["DEMO_USERNAME", "DEMO_PASSWORD_HASH", "SESSION_SECRET"]);

function loadLocalAuthentication(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
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
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForHealth(server: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error("The browser-test server exited early.");
    try {
      const response = await fetch("http://127.0.0.1:3000/api/health");
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
  server.kill("SIGTERM");
  await Promise.race([
    waitForExit(server),
    new Promise<void>((resolve) =>
      setTimeout(() => {
        if (server.exitCode === null) server.kill("SIGKILL");
        resolve();
      }, 5_000),
    ),
  ]);
}

async function main(): Promise<void> {
  const environment = loadLocalAuthentication();
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  const server = spawn(process.execPath, [".next/standalone/server.js"], {
    env: { ...environment, HOSTNAME: "127.0.0.1", PORT: "3000" },
    stdio: "inherit",
  });

  try {
    await waitForHealth(server);
    const playwright = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test"], {
      env: { ...environment, PLAYWRIGHT_EXTERNAL_SERVER: "1" },
      stdio: "inherit",
    });
    const exitCode = await waitForExit(playwright);
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    await stopServer(server);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Browser tests failed."}\n`);
  process.exitCode = 1;
});
