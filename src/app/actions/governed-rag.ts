"use server";

import { runEvidenceSchema } from "@/domain/runtime/run-evidence";
import { AO011_JUDGE_FIXTURE_TARGET } from "@/domain/runtime/model-runtime";
import { executeGovernedRag, type GovernedRunResult } from "@/server/runtime/executor";
import { JudgeFixtureAdapter } from "@/server/runtime/judge-fixture-adapter";
import { OllamaLocalAdapter } from "@/server/runtime/ollama-local-adapter";
import {
  createTrustedPreExecutionEvidence,
  RunEvidenceRecorder,
} from "@/server/runtime/run-evidence-recorder";
import { projectRunEvidenceForLog } from "@/server/runtime/run-evidence-log";
import { requireSession } from "@/server/auth/authorization";
import { getRuntimeConfig } from "@/server/runtime-config";
import { logger } from "@/server/logger";
import { validateGovernedRequestBoundary } from "@/server/security/governed-request-limits";
import { governedRequestRateLimiter } from "@/server/security/request-rate-limiter";

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
    (result.status === "completed" || result.code === validated.data.code) &&
    (result.status === "blocked" && result.code === "RATE_LIMIT_EXCEEDED"
      ? Number.isInteger(result.retryAfterSeconds) &&
        result.retryAfterSeconds !== undefined &&
        result.retryAfterSeconds >= 1 &&
        result.retryAfterSeconds <= 60
      : !("retryAfterSeconds" in result));
  const safeResult = envelopeMatches
    ? ({ ...result, evidence: validated.data } as GovernedRunResult)
    : runEvidenceInvalidResult();
  logger.info("governed_rag_run", projectRunEvidenceForLog(safeResult.evidence));
  return safeResult;
}

export async function runGovernedRagAction(input: unknown): Promise<GovernedRunResult> {
  const session = await requireSession();
  const rate = await governedRequestRateLimiter.consume(session.sub);
  if (!rate.allowed)
    return validateLogAndReturn({
      status: "blocked",
      code: rate.code,
      retryAfterSeconds: rate.retryAfterSeconds,
      databaseAccess: "not_opened_or_queried",
      evidence: createTrustedPreExecutionEvidence(rate.code),
    });
  const parsed = validateGovernedRequestBoundary(input);
  if (!parsed.success)
    return validateLogAndReturn({
      status: "blocked",
      code: "REQUEST_INVALID",
      databaseAccess: "not_opened_or_queried",
      evidence: createTrustedPreExecutionEvidence("REQUEST_INVALID"),
    });
  const config = getRuntimeConfig();
  if (config.executionMode === "disabled")
    return validateLogAndReturn({
      status: "not-configured",
      code: "LOCAL_EXECUTION_NOT_ENABLED",
      databaseAccess: "not_opened_or_queried",
      evidence: createTrustedPreExecutionEvidence("LOCAL_EXECUTION_NOT_ENABLED"),
    });
  try {
    const execution =
      config.executionMode === "judge_fixture"
        ? {
            adapter: new JudgeFixtureAdapter(),
            targetOverride: AO011_JUDGE_FIXTURE_TARGET,
          }
        : { adapter: new OllamaLocalAdapter(config.ollamaBaseUrl) };
    const result = await executeGovernedRag({
      workflow: parsed.workflow,
      question: parsed.question,
      subject: session.sub,
      ...execution,
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
