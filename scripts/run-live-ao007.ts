import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { executeGovernedRag } from "../src/server/runtime/executor";
import { OpenAIResponsesAdapter } from "../src/server/runtime/openai-responses-adapter";

if (
  process.env.RUN_LIVE_OPENAI_TESTS !== "true" ||
  process.env.AI_ORCHESTRA_LIVE_EXECUTION_ENABLED !== "true"
)
  throw new Error("LIVE_GATE_DISABLED");
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("LIVE_KEY_MISSING");

const workflow = JSON.parse(readFileSync("templates/enterprise-rag.v1.json", "utf8"));
const result = await executeGovernedRag({
  workflow,
  question: "What controls keep the AI Orchestra Enterprise RAG run governed?",
  subject: "ao007-live-smoke",
  adapter: new OpenAIResponsesAdapter(apiKey),
  limits: {
    timeoutMs: 30_000,
    maximumTotalTokens: 12_000,
    maximumOutputTokens: 2_048,
    maximumRunCostUsd: 0.25,
    maximumConcurrentRuns: 1,
  },
});
if (result.status !== "completed") throw new Error(`LIVE_SMOKE_${result.status.toUpperCase()}`);
if (result.citations.length === 0 || result.databaseAccess !== "not_opened_or_queried")
  throw new Error("LIVE_SMOKE_GOVERNANCE_FAILED");
mkdirSync("test-results", { recursive: true });
writeFileSync(
  "test-results/ao007-live-receipt.json",
  `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      status: result.status,
      provider: "openai-responses",
      model: "gpt-5.6",
      citationCount: result.citations.length,
      usage: result.usage,
      estimatedCostUsd: result.estimatedCostUsd,
      durationMs: result.durationMs,
      databaseAccess: result.databaseAccess,
      toolsUsed: false,
    },
    null,
    2,
  )}\n`,
);
console.log("AO-007 live smoke passed; sanitized ignored receipt written.");
