"use server";

import { z } from "zod";
import { executeGovernedRag, type GovernedRunResult } from "@/server/runtime/executor";
import { OllamaLocalAdapter } from "@/server/runtime/ollama-local-adapter";
import { requireSession } from "@/server/auth/authorization";
import { getRuntimeConfig } from "@/server/runtime-config";
import { logger } from "@/server/logger";

const requestSchema = z.object({ workflow: z.unknown(), question: z.string() }).strict();
export async function runGovernedRagAction(input: unknown): Promise<GovernedRunResult> {
  const session = await requireSession();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return { status: "blocked", code: "REQUEST_INVALID", databaseAccess: "not_opened_or_queried" };
  const config = getRuntimeConfig();
  if (!config.localExecutionEnabled)
    return {
      status: "not-configured",
      code: "LOCAL_EXECUTION_NOT_ENABLED",
      databaseAccess: "not_opened_or_queried",
    };
  const result = await executeGovernedRag({
    workflow: parsed.data.workflow,
    question: parsed.data.question,
    subject: session.sub,
    adapter: new OllamaLocalAdapter(config.ollamaBaseUrl),
    limits: {
      timeoutMs: config.localTimeoutMs,
      maximumTotalTokens: config.maximumTotalTokens,
      maximumOutputTokens: config.localMaximumOutputTokens,
      maximumRunCostUsd: 1,
      maximumConcurrentRuns: config.maximumConcurrentRuns,
    },
  });
  logger.info("governed_rag_run", {
    status: result.status,
    ...(result.status === "completed"
      ? {
          durationMs: result.durationMs,
          totalTokens: result.usage.totalTokens,
          provider: result.provider,
          model: result.model,
        }
      : { code: result.code }),
  });
  return result;
}
