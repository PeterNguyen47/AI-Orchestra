"use server";

import { z } from "zod";
import { executeGovernedRag, type GovernedRunResult } from "@/server/runtime/executor";
import { OpenAIResponsesAdapter } from "@/server/runtime/openai-responses-adapter";
import { requireSession } from "@/server/auth/authorization";
import { getRuntimeConfig } from "@/server/runtime-config";
import { logger } from "@/server/logger";

const requestSchema = z
  .object({ workflow: z.unknown(), question: z.string(), creditAcknowledged: z.literal(true) })
  .strict();

export async function runGovernedRagAction(input: unknown): Promise<GovernedRunResult> {
  const session = await requireSession();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return { status: "blocked", code: "REQUEST_INVALID", databaseAccess: "not_opened_or_queried" };
  const config = getRuntimeConfig();
  if (!config.executionConfigured || !config.openAiApiKey)
    return {
      status: "not-configured",
      code: "LIVE_EXECUTION_NOT_CONFIGURED",
      databaseAccess: "not_opened_or_queried",
    };
  const result = await executeGovernedRag({
    workflow: parsed.data.workflow,
    question: parsed.data.question,
    subject: session.sub,
    adapter: new OpenAIResponsesAdapter(config.openAiApiKey),
    limits: {
      timeoutMs: config.runTimeoutMs,
      maximumTotalTokens: config.maximumTotalTokens,
      maximumOutputTokens: config.maximumOutputTokens,
      maximumRunCostUsd: config.maximumRunCostUsd,
      maximumConcurrentRuns: config.maximumConcurrentRuns,
    },
  });
  logger.info("governed_rag_run", {
    status: result.status,
    ...(result.status === "completed"
      ? { durationMs: result.durationMs, totalTokens: result.usage.totalTokens }
      : { code: result.code }),
  });
  return result;
}
