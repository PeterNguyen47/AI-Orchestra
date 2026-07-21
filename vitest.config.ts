import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.{ts,mjs}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "scripts/check-secrets.mjs",
        "scripts/check-judge-readiness.ts",
        "scripts/e2e-fixture-boundary.ts",
        "scripts/setup-judge-auth.ts",
        "src/app/actions/governed-rag.ts",
        "src/app/api/health/route.ts",
        "src/config/**/*.ts",
        "src/domain/security/**/*.ts",
        "src/domain/workflow/**/*.ts",
        "src/domain/orchestrator/**/*.ts",
        "src/domain/exports/**/*.ts",
        "src/domain/runtime/**/*.ts",
        "src/server/log-record.ts",
        "src/server/security/**/*.ts",
        "src/server/runtime-config.schema.ts",
        "src/server/auth/auth-config.ts",
        "src/server/auth/password-core.ts",
        "src/server/auth/session-core.ts",
        "src/server/auth/demo-setup.ts",
        "src/server/dashboard/dashboard-summary.ts",
        "src/server/orchestrator/load-enterprise-rag.ts",
        "src/server/runtime/executor.ts",
        "src/server/runtime/judge-fixture-adapter.ts",
        "src/server/runtime/knowledge-corpus.ts",
        "src/server/runtime/ollama-local-adapter.ts",
      ],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});
