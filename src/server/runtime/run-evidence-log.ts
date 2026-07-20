import "server-only";

import type { RunEvidence } from "@/domain/runtime/run-evidence";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export function projectRunEvidenceForLog(evidence: RunEvidence) {
  const provider = evidence.modelEvidence?.target.provider;
  const model = evidence.modelEvidence?.observed?.model ?? evidence.modelEvidence?.target.model;
  const usage = evidence.metrics.usage;

  return deepFreeze({
    runId: evidence.runId,
    status: evidence.status,
    code: evidence.code,
    stageOutcomes: evidence.timeline.map((entry) => ({
      sequence: entry.sequence,
      nodeId: entry.nodeId,
      outcome: entry.outcome,
    })),
    totalDurationMs: evidence.metrics.totalDurationMs,
    ...(evidence.metrics.providerDurationMs === undefined
      ? {}
      : { providerDurationMs: evidence.metrics.providerDurationMs }),
    ...(usage
      ? {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        }
      : {}),
    ...(evidence.metrics.estimatedCostUsd === undefined
      ? {}
      : { estimatedCostUsd: evidence.metrics.estimatedCostUsd }),
    ...(evidence.metrics.externalApiCostUsd === undefined
      ? {}
      : { externalApiCostUsd: evidence.metrics.externalApiCostUsd }),
    localComputeCostMeasured: evidence.metrics.localComputeCostMeasured,
    ...(evidence.evaluatorResults
      ? {
          evaluatorStatuses: evidence.evaluatorResults.map((result) => ({
            evaluatorId: result.evaluatorId,
            status: result.status,
          })),
        }
      : {}),
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    securityControls: {
      modelCallsServerSide: evidence.securityControls.modelCallsServerSide,
      providerSelectionExposedToBrowser:
        evidence.securityControls.providerSelectionExposedToBrowser,
      credentialsStored: evidence.securityControls.credentialsStored,
      promptsStored: evidence.securityControls.promptsStored,
      rawErrorsStored: evidence.securityControls.rawErrorsStored,
      databaseOpened: evidence.securityControls.databaseOpened,
      databaseQueried: evidence.securityControls.databaseQueried,
      remoteTracingUsed: evidence.securityControls.remoteTracingUsed,
      persistenceUsed: evidence.securityControls.persistenceUsed,
      toolsUsed: evidence.securityControls.toolsUsed,
      handoffsUsed: evidence.securityControls.handoffsUsed,
      thinkingStored: evidence.securityControls.thinkingStored,
    },
  });
}

export type RunEvidenceLogProjection = ReturnType<typeof projectRunEvidenceForLog>;
