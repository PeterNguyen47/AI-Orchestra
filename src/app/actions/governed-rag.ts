"use server";

import { z } from "zod";
import {
  MAX_RUN_EVIDENCE_INPUT_CHARACTERS,
  runEvidenceSchema,
} from "@/domain/runtime/run-evidence";
import { executeGovernedRag, type GovernedRunResult } from "@/server/runtime/executor";
import { OllamaLocalAdapter } from "@/server/runtime/ollama-local-adapter";
import {
  createTrustedPreExecutionEvidence,
  RunEvidenceRecorder,
} from "@/server/runtime/run-evidence-recorder";
import { projectRunEvidenceForLog } from "@/server/runtime/run-evidence-log";
import { requireSession } from "@/server/auth/authorization";
import { getRuntimeConfig } from "@/server/runtime-config";
import { logger } from "@/server/logger";

const requestSchema = z
  .object({
    workflow: z.unknown(),
    question: z.string().max(MAX_RUN_EVIDENCE_INPUT_CHARACTERS),
  })
  .strict();

function runEvidenceInvalidResult(): GovernedRunResult {
  const evidence = new RunEvidenceRecorder().finalize({
    status: "failed",
    code: "RUN_EVIDENCE_INVALID",
  });
  return {
    status: "failed",
    code: "RUN_EVIDENCE_INVALID",
    databaseAccess: "not_opened_or_queried",
    evidence,
  };
}

function validateLogAndReturn(result: GovernedRunResult): GovernedRunResult {
  const validated = runEvidenceSchema.safeParse(result.evidence);
  const envelopeMatches =
    validated.success &&
    result.status === validated.data.status &&
    (result.status === "completed" || result.code === validated.data.code);
  const safeResult = envelopeMatches
    ? ({ ...result, evidence: validated.data } as GovernedRunResult)
    : runEvidenceInvalidResult();
  logger.info("governed_rag_run", projectRunEvidenceForLog(safeResult.evidence));
  return safeResult;
}

export async function runGovernedRagAction(input: unknown): Promise<GovernedRunResult> {
  const session = await requireSession();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return validateLogAndReturn({
      status: "blocked",
      code: "REQUEST_INVALID",
      databaseAccess: "not_opened_or_queried",
      evidence: createTrustedPreExecutionEvidence("REQUEST_INVALID"),
    });
  const config = getRuntimeConfig();
  if (!config.localExecutionEnabled)
    return validateLogAndReturn({
      status: "not-configured",
      code: "LOCAL_EXECUTION_NOT_ENABLED",
      databaseAccess: "not_opened_or_queried",
      evidence: createTrustedPreExecutionEvidence("LOCAL_EXECUTION_NOT_ENABLED"),
    });
  try {
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
    return validateLogAndReturn(result);
  } catch {
    return validateLogAndReturn(runEvidenceInvalidResult());
  }
}
