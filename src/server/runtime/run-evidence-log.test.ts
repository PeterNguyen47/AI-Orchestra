import { describe, expect, it } from "vitest";
import { runDeterministicEvaluators } from "@/domain/runtime/evaluations";
import { getDiagnosticExplanation, type RunEvidence } from "@/domain/runtime/run-evidence";
import { createTrustedPreExecutionEvidence, RunEvidenceRecorder } from "./run-evidence-recorder";
import { projectRunEvidenceForLog } from "./run-evidence-log";

const RUN_ID = "run_00000000-0000-4000-8000-000000000002";
const TARGET = {
  provider: "ollama-local",
  model: "qwen3:4b",
  deploymentMode: "local_machine",
} as const;

const options = () => {
  const readings = [10, 40];
  let index = 0;
  return {
    runIdFactory: () => RUN_ID,
    clock: () => readings[Math.min(index++, readings.length - 1)]!,
  };
};

function successfulEvidence(): RunEvidence {
  const recorder = new RunEvidenceRecorder(options());
  recorder.markPlanValid(TARGET);
  recorder.passStage("user-input");
  recorder.passStage("input-guardrail").recordInputGuardrailDecision({
    status: "passed",
    code: "INPUT_GUARDRAIL_PASSED",
    explanation: getDiagnosticExplanation("INPUT_GUARDRAIL_PASSED"),
    inputCharacterCount: 25,
    maximumInputCharacters: 4_000,
    promptInjectionDetectionEnabled: true,
  });
  recorder.passStage("document-source");
  recorder.passStage("retrieval").recordRetrievalEvidence({
    status: "passed",
    code: "RETRIEVAL_COMPLETED",
    explanation: getDiagnosticExplanation("RETRIEVAL_COMPLETED"),
    requestedTopK: 3,
    returnedChunkCount: 1,
    minimumRelevanceThreshold: 0.2,
    maximumContextCharacters: 6_000,
    relevance: { minimum: 0.75, maximum: 0.75, mean: 0.75 },
  });
  recorder.passStage("gpt-agent").recordModelEvidence({
    target: TARGET,
    observed: {
      model: "qwen3:4b-fixture",
      modelDigest: "sha256:fixture",
      runtime: "Ollama",
      runtimeVersion: "0.0.0-e2e-fixture",
    },
    invocationReached: true,
    toolsUsed: false,
    thinkingUsed: false,
    handoffsUsed: false,
    persistenceUsed: false,
  });
  recorder.passStage("output-guardrail").recordOutputGuardrailDecision({
    status: "passed",
    code: "OUTPUT_GUARDRAIL_PASSED",
    explanation: getDiagnosticExplanation("OUTPUT_GUARDRAIL_PASSED"),
    schemaValidated: true,
    citationsRequired: true,
    citationsValidated: true,
    acceptedCitationCount: 1,
    activeContentDetected: false,
    sensitiveDataDetected: false,
    insufficientContext: false,
  });
  recorder.passStage("evaluator").recordEvaluatorResults(
    runDeterministicEvaluators({
      citationsRequired: true,
      citationIds: ["security-controls#chunk-001"],
      acceptedCitationIds: new Set(["security-controls#chunk-001"]),
      meanRelevance: 0.75,
      outputSchemaValid: true,
      citationStructureValid: true,
      thresholds: {
        citationCoverage: 1,
        retrievalRelevance: 0.2,
        structuralGrounding: 1,
      },
    }),
  );
  recorder.passStage("response-output");
  recorder.recordMetrics({
    providerDurationMs: 11,
    usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
    estimatedCostUsd: 0,
    externalApiCostUsd: 0,
  });
  return recorder.finalize({ status: "completed", code: "RUN_COMPLETED" });
}

describe("projectRunEvidenceForLog", () => {
  it("projects the fixed success allowlist with reconciled metrics and evaluator statuses", () => {
    const evidence = successfulEvidence();
    const projection = projectRunEvidenceForLog(evidence);

    expect(projection).toMatchObject({
      runId: RUN_ID,
      status: "completed",
      code: "RUN_COMPLETED",
      totalDurationMs: 30,
      providerDurationMs: 11,
      inputTokens: 80,
      outputTokens: 20,
      totalTokens: 100,
      estimatedCostUsd: 0,
      externalApiCostUsd: 0,
      localComputeCostMeasured: false,
      provider: "ollama-local",
      model: "qwen3:4b-fixture",
      securityControls: {
        modelCallsServerSide: true,
        providerSelectionExposedToBrowser: false,
        credentialsStored: false,
        promptsStored: false,
        rawErrorsStored: false,
        databaseOpened: false,
        databaseQueried: false,
        remoteTracingUsed: false,
        persistenceUsed: false,
        toolsUsed: false,
        handoffsUsed: false,
        thinkingStored: false,
      },
    });
    expect(projection.stageOutcomes).toHaveLength(9);
    expect(projection.evaluatorStatuses).toEqual([
      { evaluatorId: "citation_coverage.v1", status: "passed" },
      { evaluatorId: "retrieval_relevance.v1", status: "passed" },
      { evaluatorId: "structural_grounding.v1", status: "passed" },
    ]);
  });

  it("excludes sentinel content even when an untrusted object carries sensitive fields", () => {
    const sentinel = "SENTINEL-question-answer-cookie-token-path-host-user-thinking";
    const evidence = successfulEvidence();
    const tainted = {
      ...evidence,
      explanation: sentinel,
      question: sentinel,
      answerMarkdown: sentinel,
      citations: [{ title: sentinel, passage: sentinel }],
      rawProviderBody: sentinel,
      rawError: sentinel,
      stack: sentinel,
      cookie: sentinel,
      authorization: sentinel,
      session: sentinel,
      environment: sentinel,
      filesystemPath: sentinel,
      hostname: sentinel,
      username: sentinel,
      thinking: sentinel,
    } as RunEvidence;

    const serialized = JSON.stringify(projectRunEvidenceForLog(tainted));
    expect(serialized).not.toContain(sentinel);
    expect(serialized).not.toContain("answerMarkdown");
    expect(serialized).not.toContain("rawProviderBody");
  });

  it("omits unavailable provider fields and freezes the pre-execution projection", () => {
    const evidence = createTrustedPreExecutionEvidence("REQUEST_INVALID", options());
    const projection = projectRunEvidenceForLog(evidence);

    expect(projection).not.toHaveProperty("provider");
    expect(projection).not.toHaveProperty("model");
    expect(projection).not.toHaveProperty("providerDurationMs");
    expect(projection).not.toHaveProperty("inputTokens");
    expect(projection).not.toHaveProperty("evaluatorStatuses");
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.stageOutcomes)).toBe(true);
    expect(Object.isFrozen(projection.securityControls)).toBe(true);
  });
});
