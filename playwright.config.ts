import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const localEnvironmentPath = ".env.local";
if (existsSync(localEnvironmentPath)) {
  for (const line of readFileSync(localEnvironmentPath, "utf8").split(/\r?\n/)) {
    const match = /^(DEMO_USERNAME|DEMO_PASSWORD_HASH|SESSION_SECRET)=(.*)$/.exec(line);
    if (match?.[1] && match[2] !== undefined && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(process.env.PLAYWRIGHT_EXTERNAL_SERVER
    ? {}
    : {
        webServer: {
          command: "node .next/standalone/server.js",
          url: "http://127.0.0.1:3000/api/health",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
