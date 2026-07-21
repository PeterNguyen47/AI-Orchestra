import { describe, expect, it } from "vitest";
import { runDeterministicEvaluators } from "@/domain/runtime/evaluations";
import { CANONICAL_TIMELINE, getDiagnosticExplanation } from "@/domain/runtime/run-evidence";
import {
  createTrustedPreExecutionEvidence,
  RunEvidenceRecorder,
  type RunEvidenceRecorderOptions,
} from "./run-evidence-recorder";

const RUN_ID = "run_00000000-0000-4000-8000-000000000001";
const TARGET = {
  provider: "ollama-local",
  model: "qwen3:4b",
  deploymentMode: "local_machine",
} as const;

function deterministicOptions(runId = RUN_ID, durationMs = 25): RunEvidenceRecorderOptions {
  const readings = [100, 100 + durationMs];
  let index = 0;
  return {
    runIdFactory: () => runId,
    clock: () => readings[Math.min(index++, readings.length - 1)]!,
  };
}

const inputPassed = {
  status: "passed",
  code: "INPUT_GUARDRAIL_PASSED",
  explanation: getDiagnosticExplanation("INPUT_GUARDRAIL_PASSED"),
  inputCharacterCount: 23,
  maximumInputCharacters: 4_000,
  promptInjectionDetectionEnabled: true,
} as const;

const retrievalPassed = {
  status: "passed",
  code: "RETRIEVAL_COMPLETED",
  explanation: getDiagnosticExplanation("RETRIEVAL_COMPLETED"),
  requestedTopK: 3,
  returnedChunkCount: 2,
  minimumRelevanceThreshold: 0.2,
  maximumContextCharacters: 6_000,
  relevance: { minimum: 0.4, maximum: 0.8, mean: 0.6 },
} as const;

const outputPassed = {
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
} as const;

function completedRecorder(): RunEvidenceRecorder {
  const recorder = new RunEvidenceRecorder(deterministicOptions());
  recorder.markPlanValid(TARGET);
  recorder.passStage("user-input");
  recorder.passStage("input-guardrail").recordInputGuardrailDecision(inputPassed);
  recorder.passStage("document-source");
  recorder.passStage("retrieval").recordRetrievalEvidence(retrievalPassed);
  recorder.passStage("gpt-agent").recordModelEvidence({
    target: TARGET,
    observed: {
      model: "qwen3:4b",
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
  recorder.passStage("output-guardrail").recordOutputGuardrailDecision(outputPassed);
  recorder.passStage("evaluator").recordEvaluatorResults(
    runDeterministicEvaluators({
      citationsRequired: true,
      citationIds: ["security-controls#chunk-001"],
      acceptedCitationIds: new Set(["security-controls#chunk-001"]),
      meanRelevance: 0.6,
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
    providerDurationMs: 12,
    usage: { inputTokens: 40, outputTokens: 10, totalTokens: 50 },
    estimatedCostUsd: 0,
    externalApiCostUsd: 0,
  });
  return recorder;
}

describe("RunEvidenceRecorder", () => {
  it("creates trusted request-invalid evidence with a canonical pre-plan timeline", () => {
    const evidence = createTrustedPreExecutionEvidence("REQUEST_INVALID", deterministicOptions());

    expect(evidence).toMatchObject({
      schemaVersion: "1.0.0",
      runId: RUN_ID,
      status: "blocked",
      code: "REQUEST_INVALID",
      explanation: getDiagnosticExplanation("REQUEST_INVALID"),
      metrics: {
        totalDurationMs: 25,
        estimatedCostUsd: 0,
        externalApiCostUsd: 0,
        localComputeCostMeasured: false,
      },
    });
    expect(evidence.timeline).toHaveLength(9);
    expect(
      evidence.timeline.map(({ sequence, nodeId, nodeType }) => ({ sequence, nodeId, nodeType })),
    ).toEqual(CANONICAL_TIMELINE);
    expect(evidence.timeline.slice(0, 8).every((entry) => entry.outcome === "not-started")).toBe(
      true,
    );
    expect(evidence.timeline[8]?.outcome).toBe("skipped");
  });

  it("creates trusted rate-limit evidence without retry metadata or model state", () => {
    const evidence = createTrustedPreExecutionEvidence(
      "RATE_LIMIT_EXCEEDED",
      deterministicOptions(),
    );
    expect(evidence).toMatchObject({
      schemaVersion: "1.0.0",
      status: "blocked",
      code: "RATE_LIMIT_EXCEEDED",
    });
    expect(evidence.timeline.map((entry) => entry.outcome)).toEqual([
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "skipped",
    ]);
    expect(evidence).not.toHaveProperty("retryAfterSeconds");
    expect(evidence).not.toHaveProperty("modelEvidence");
  });

  it("creates trusted disabled evidence without model or database execution", () => {
    const evidence = createTrustedPreExecutionEvidence(
      "LOCAL_EXECUTION_NOT_ENABLED",
      deterministicOptions(),
    );

    expect(evidence).toMatchObject({
      status: "not-configured",
      code: "LOCAL_EXECUTION_NOT_ENABLED",
      securityControls: {
        modelCallsServerSide: true,
        databaseOpened: false,
        databaseQueried: false,
        toolsUsed: false,
        handoffsUsed: false,
      },
    });
    expect(evidence.modelEvidence).toBeUndefined();
    expect(evidence.timeline[8]?.outcome).toBe("skipped");
  });

  it("retains the input stage and skips downstream stages after an input block", () => {
    const recorder = new RunEvidenceRecorder(deterministicOptions());
    recorder.markPlanValid(TARGET);
    recorder.passStage("user-input");
    recorder.blockStage("input-guardrail").recordInputGuardrailDecision({
      status: "blocked",
      code: "INSTRUCTION_OVERRIDE",
      explanation: getDiagnosticExplanation("INSTRUCTION_OVERRIDE"),
      inputCharacterCount: 51,
      maximumInputCharacters: 4_000,
      promptInjectionDetectionEnabled: true,
    });
    recorder.skipRemainingAfter("input-guardrail");

    const evidence = recorder.finalize({ status: "blocked", code: "INSTRUCTION_OVERRIDE" });
    expect(evidence.timeline.map((entry) => entry.outcome)).toEqual([
      "passed",
      "blocked",
      "skipped",
      "skipped",
      "skipped",
      "skipped",
      "skipped",
      "skipped",
      "simulated",
    ]);
    expect(evidence.modelEvidence).toMatchObject({ invocationReached: false, target: TARGET });
  });

  it("retains prior decisions when the document source fails", () => {
    const recorder = new RunEvidenceRecorder(deterministicOptions());
    recorder.markPlanValid(TARGET);
    recorder.passStage("user-input");
    recorder.passStage("input-guardrail").recordInputGuardrailDecision(inputPassed);
    recorder.failStage("document-source");
    recorder.skipRemainingAfter("document-source");

    const evidence = recorder.finalize({
      status: "failed",
      code: "DOCUMENT_SOURCE_UNAVAILABLE",
    });
    expect(evidence.timeline.slice(0, 4).map((entry) => entry.outcome)).toEqual([
      "passed",
      "passed",
      "failed",
      "skipped",
    ]);
    expect(evidence.inputGuardrailDecision).toEqual(inputPassed);
    expect(evidence.retrievalEvidence).toBeUndefined();
  });

  it("finalizes immutable completed evidence with reconciled metrics", () => {
    const evidence = completedRecorder().finalize({ status: "completed", code: "RUN_COMPLETED" });

    expect(evidence.timeline.slice(0, 8).every((entry) => entry.outcome === "passed")).toBe(true);
    expect(evidence.timeline[8]?.outcome).toBe("simulated");
    expect(evidence.metrics).toMatchObject({
      totalDurationMs: 25,
      providerDurationMs: 12,
      usage: { inputTokens: 40, outputTokens: 10, totalTokens: 50 },
    });
    expect(evidence.evaluatorResults).toHaveLength(3);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.timeline)).toBe(true);
    expect(Object.isFrozen(evidence.metrics.usage)).toBe(true);
  });

  it("rejects illegal, repeated, and database execution transitions", () => {
    const recorder = new RunEvidenceRecorder(deterministicOptions());
    expect(() => recorder.passStage("retrieval")).toThrow("RUN_EVIDENCE_ILLEGAL_TRANSITION");
    expect(() => recorder.passStage("simulated-relational-database")).toThrow(
      "RUN_EVIDENCE_ILLEGAL_TRANSITION",
    );
    expect(() => recorder.simulateStage("gpt-agent")).toThrow("RUN_EVIDENCE_ILLEGAL_TRANSITION");
    recorder.passStage("user-input");
    expect(() => recorder.passStage("user-input")).toThrow("RUN_EVIDENCE_ILLEGAL_TRANSITION");
  });

  it("rejects every mutation and a second terminal result after finalization", () => {
    const recorder = new RunEvidenceRecorder(deterministicOptions());
    recorder.finalize({ status: "blocked", code: "REQUEST_INVALID" });

    expect(() => recorder.finalize({ status: "blocked", code: "REQUEST_INVALID" })).toThrow(
      "RUN_EVIDENCE_ALREADY_FINALIZED",
    );
    expect(() => recorder.skipStage("user-input")).toThrow("RUN_EVIDENCE_ALREADY_FINALIZED");
  });

  it("omits unsafe observed metadata and fails closed on invalid reconciled usage", () => {
    const recorder = new RunEvidenceRecorder(deterministicOptions());
    recorder.markPlanValid(TARGET);
    recorder.passStage("user-input");
    recorder.passStage("input-guardrail").recordInputGuardrailDecision(inputPassed);
    recorder.passStage("document-source");
    recorder.passStage("retrieval").recordRetrievalEvidence(retrievalPassed);
    recorder.failStage("gpt-agent").recordModelEvidence({
      target: TARGET,
      observed: {
        model: "unsafe model identifier",
        modelDigest: "sha256:safe",
        runtime: "C:\\private\\runtime",
        runtimeVersion: "version with spaces",
      },
      invocationReached: true,
      toolsUsed: false,
      thinkingUsed: false,
      handoffsUsed: false,
      persistenceUsed: false,
    });
    recorder.skipRemainingAfter("gpt-agent");
    const evidence = recorder.finalize({ status: "failed", code: "PROVIDER_ERROR" });
    expect(evidence.modelEvidence?.observed).toEqual({ modelDigest: "sha256:safe" });

    const invalid = new RunEvidenceRecorder(deterministicOptions());
    invalid.recordMetrics({ usage: { inputTokens: 2, outputTokens: 3, totalTokens: 99 } });
    expect(() => invalid.finalize({ status: "blocked", code: "REQUEST_INVALID" })).toThrow();
  });
});
