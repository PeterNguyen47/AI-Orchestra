import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { parseRuntimeConfig } from "../src/server/runtime-config.schema";

function safeFailureCode(error: unknown): string {
  if (error instanceof Error && /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(error.message)) {
    return error.message;
  }
  return "LOCAL_LIVE_SCRIPT_FAILED";
}

function normalizeStableCodePart(value: string): string {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "UNKNOWN";
}

function retainSafeResultCode(value: string): string {
  return /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(value) ? value : "UNKNOWN";
}

async function main(): Promise<void> {
  const config = parseRuntimeConfig(process.env);
  if (!config.localExecutionEnabled) throw new Error("LOCAL_GATE_DISABLED");
  const [{ executeGovernedRag }, { OllamaLocalAdapter }] = await Promise.all([
    import("../src/server/runtime/executor"),
    import("../src/server/runtime/ollama-local-adapter"),
  ]);
  let generationRequests = 0;
  const countedFetch: typeof fetch = async (input, init) => {
    if (String(input).endsWith("/api/chat")) generationRequests += 1;
    return fetch(input, init);
  };
  const workflow = JSON.parse(readFileSync("templates/enterprise-rag.v1.json", "utf8"));
  const result = await executeGovernedRag({
    workflow,
    question:
      "What controls protect input, retrieval, model output, citations, credentials, and logs?",
    subject: "ao007-local-live-smoke",
    adapter: new OllamaLocalAdapter(config.ollamaBaseUrl, countedFetch),
    limits: {
      timeoutMs: config.localTimeoutMs,
      maximumTotalTokens: config.maximumTotalTokens,
      maximumOutputTokens: config.localMaximumOutputTokens,
      maximumRunCostUsd: 1,
      maximumConcurrentRuns: 1,
    },
  });
  if (generationRequests > 1) throw new Error("LOCAL_GENERATION_REQUEST_COUNT_INVALID");
  if (result.status !== "completed")
    throw new Error(
      `LOCAL_SMOKE_${normalizeStableCodePart(result.status)}_${retainSafeResultCode(result.code)}`,
    );
  if (generationRequests !== 1) throw new Error("LOCAL_GENERATION_REQUEST_COUNT_INVALID");
  const receipt = {
    schemaVersion: "1.0.0",
    status: result.status,
    provider: result.provider,
    model: result.model,
    ...(result.modelDigest ? { modelDigest: result.modelDigest } : {}),
    runtime: result.runtime ?? "Ollama",
    ...(result.runtimeVersion ? { runtimeVersion: result.runtimeVersion } : {}),
    deploymentMode: "local_machine",
    citationCount: result.citations.length,
    usage: result.usage,
    externalApiCostUsd: result.externalApiCostUsd,
    localComputeCostMeasured: result.localComputeCostMeasured,
    durationMs: result.durationMs,
    databaseAccess: result.databaseAccess,
    toolsUsed: result.toolsUsed,
    thinkingUsed: result.thinkingUsed,
    persistenceUsed: result.persistenceUsed,
    timestamp: new Date().toISOString(),
  };
  const receiptSchema = z
    .object({
      schemaVersion: z.literal("1.0.0"),
      status: z.literal("completed"),
      provider: z.literal("ollama-local"),
      model: z.literal("qwen3:4b"),
      modelDigest: z.string().min(1).optional(),
      runtime: z.literal("Ollama"),
      runtimeVersion: z.string().min(1).optional(),
      deploymentMode: z.literal("local_machine"),
      citationCount: z.number().int().positive(),
      usage: z
        .object({
          inputTokens: z.number().int().positive(),
          outputTokens: z.number().int().positive(),
          totalTokens: z.number().int().positive(),
        })
        .strict(),
      externalApiCostUsd: z.literal(0),
      localComputeCostMeasured: z.literal(false),
      durationMs: z.number().positive().max(config.localTimeoutMs),
      databaseAccess: z.literal("not_opened_or_queried"),
      toolsUsed: z.literal(false),
      thinkingUsed: z.literal(false),
      persistenceUsed: z.literal(false),
      timestamp: z.iso.datetime(),
    })
    .strict();
  receiptSchema.parse(receipt);
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/ao007-local-model-receipt.json",
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  console.log(
    "AO-007 local smoke passed; one generation request; sanitized ignored receipt written.",
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${safeFailureCode(error)}\n`);
  process.exitCode = 1;
});
