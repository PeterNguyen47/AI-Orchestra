import { describe, expect, it } from "vitest";
import { runDeterministicEvaluators } from "./evaluations";
import {
  CANONICAL_TIMELINE,
  DIAGNOSTIC_EXPLANATIONS,
  MAX_RUN_EVIDENCE_INPUT_CHARACTERS,
  diagnosticCodeSchema,
  getDiagnosticExplanation,
  runEvidenceSchema,
  serializeRunEvidence,
  type DiagnosticCode,
  type RunEvidenceInput,
  type RunEvidenceStatus,
  type TimelineOutcome,
} from "./run-evidence";

const RUN_ID = "run_00000000-0000-4000-8000-000000000001";
const OTHER_RUN_ID = "run_00000000-0000-4000-8000-000000000002";

const securityControls = {
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
} as const;

function timeline(outcomes: ReadonlyArray<TimelineOutcome>) {
  return CANONICAL_TIMELINE.map((entry, index) => ({
    ...entry,
    outcome: outcomes[index]!,
  }));
}

const inputPassed = {
  status: "passed",
  code: "INPUT_GUARDRAIL_PASSED",
  explanation: DIAGNOSTIC_EXPLANATIONS.INPUT_GUARDRAIL_PASSED,
  inputCharacterCount: 21,
  maximumInputCharacters: 4_000,
  promptInjectionDetectionEnabled: true,
} as const;

const retrievalPassed = {
  status: "passed",
  code: "RETRIEVAL_COMPLETED",
  explanation: DIAGNOSTIC_EXPLANATIONS.RETRIEVAL_COMPLETED,
  requestedTopK: 5,
  returnedChunkCount: 2,
  minimumRelevanceThreshold: 0.72,
  maximumContextCharacters: 24_000,
  relevance: { minimum: 0.8, maximum: 1, mean: 0.9 },
} as const;

const modelBeforeInvocation = {
  target: {
    provider: "deterministic-test",
    model: "ao008-fixture-model",
    deploymentMode: "test_only",
  },
  invocationReached: false,
  toolsUsed: false,
  thinkingUsed: false,
  handoffsUsed: false,
  persistenceUsed: false,
} as const;

const modelCompleted = {
  ...modelBeforeInvocation,
  observed: {
    model: "ao008-fixture-model",
    modelDigest: "sha256:fixture",
    runtime: "AO008Fixture",
    runtimeVersion: "1.0.0",
  },
  invocationReached: true,
} as const;

const outputPassed = {
  status: "passed",
  code: "OUTPUT_GUARDRAIL_PASSED",
  explanation: DIAGNOSTIC_EXPLANATIONS.OUTPUT_GUARDRAIL_PASSED,
  schemaValidated: true,
  citationsRequired: true,
  citationsValidated: true,
  acceptedCitationCount: 1,
  activeContentDetected: false,
  sensitiveDataDetected: false,
  insufficientContext: false,
} as const;

const evaluatorResults = runDeterministicEvaluators({
  citationsRequired: true,
  citationIds: ["approved#chunk-001"],
  acceptedCitationIds: new Set(["approved#chunk-001"]),
  meanRelevance: 0.9,
  outputSchemaValid: true,
  citationStructureValid: true,
  thresholds: {
    citationCoverage: 0.9,
    retrievalRelevance: 0.75,
    structuralGrounding: 0.8,
  },
});

function completedEvidence(runId = RUN_ID): RunEvidenceInput {
  return {
    schemaVersion: "1.0.0",
    runId,
    status: "completed",
    code: "RUN_COMPLETED",
    explanation: DIAGNOSTIC_EXPLANATIONS.RUN_COMPLETED,
    timeline: timeline([
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "simulated",
    ]),
    inputGuardrailDecision: inputPassed,
    retrievalEvidence: retrievalPassed,
    modelEvidence: modelCompleted,
    outputGuardrailDecision: outputPassed,
    evaluatorResults,
    metrics: {
      totalDurationMs: 125,
      providerDurationMs: 75,
      usage: { inputTokens: 40, outputTokens: 10, totalTokens: 50 },
      estimatedCostUsd: 0,
      externalApiCostUsd: 0,
      localComputeCostMeasured: false,
    },
    securityControls,
  };
}

function prePlanEvidence(
  status: Exclude<RunEvidenceStatus, "completed" | "busy">,
  code: DiagnosticCode,
): RunEvidenceInput {
  return {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    status,
    code,
    explanation: getDiagnosticExplanation(code),
    timeline: timeline([
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "skipped",
    ]),
    metrics: {
      totalDurationMs: 0,
      estimatedCostUsd: 0,
      externalApiCostUsd: 0,
      localComputeCostMeasured: false,
    },
    securityControls,
  };
}

function busyEvidence(): RunEvidenceInput {
  return {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    status: "busy",
    code: "EXECUTION_BUSY",
    explanation: DIAGNOSTIC_EXPLANATIONS.EXECUTION_BUSY,
    timeline: timeline([
      "passed",
      "passed",
      "passed",
      "passed",
      "not-started",
      "skipped",
      "skipped",
      "skipped",
      "simulated",
    ]),
    inputGuardrailDecision: inputPassed,
    retrievalEvidence: retrievalPassed,
    modelEvidence: modelBeforeInvocation,
    metrics: {
      totalDurationMs: 4,
      estimatedCostUsd: 0,
      externalApiCostUsd: 0,
      localComputeCostMeasured: false,
    },
    securityControls,
  };
}

describe("RunEvidence 1.0.0", () => {
  it("accepts and freezes a complete canonical evidence object", () => {
    const evidence = runEvidenceSchema.parse(completedEvidence());
    expect(evidence.schemaVersion).toBe("1.0.0");
    expect(evidence.timeline).toHaveLength(9);
    expect(evidence.timeline.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.timeline)).toBe(true);
    expect(Object.isFrozen(evidence.metrics.usage)).toBe(true);
  });

  it("supports the five terminal statuses with their governed codes", () => {
    const fixtures = [
      completedEvidence(),
      prePlanEvidence("blocked", "REQUEST_INVALID"),
      prePlanEvidence("failed", "RUN_EVIDENCE_INVALID"),
      busyEvidence(),
      prePlanEvidence("not-configured", "LOCAL_EXECUTION_NOT_ENABLED"),
    ];
    expect(fixtures.map((fixture) => runEvidenceSchema.parse(fixture).status)).toEqual([
      "completed",
      "blocked",
      "failed",
      "busy",
      "not-configured",
    ]);
  });

  it("exposes only recognized diagnostic codes with fixed explanations", () => {
    for (const [code, explanation] of Object.entries(DIAGNOSTIC_EXPLANATIONS)) {
      expect(diagnosticCodeSchema.parse(code)).toBe(code);
      expect(getDiagnosticExplanation(code as DiagnosticCode)).toBe(explanation);
    }
    expect(diagnosticCodeSchema.safeParse("RAW_PROVIDER_EXCEPTION").success).toBe(false);
  });

  it("rejects mismatched explanations and terminal status codes", () => {
    const base = completedEvidence();
    expect(
      runEvidenceSchema.safeParse({ ...base, explanation: "Untrusted raw exception." }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        status: "failed",
        explanation: DIAGNOSTIC_EXPLANATIONS.RUN_COMPLETED,
      }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...busyEvidence(),
        code: "PROVIDER_ERROR",
        explanation: DIAGNOSTIC_EXPLANATIONS.PROVIDER_ERROR,
      }).success,
    ).toBe(false);
    const prePlan = prePlanEvidence("blocked", "REQUEST_INVALID");
    expect(
      runEvidenceSchema.safeParse({
        ...prePlan,
        status: "busy",
        code: "EXECUTION_BUSY",
        explanation: DIAGNOSTIC_EXPLANATIONS.EXECUTION_BUSY,
      }).success,
    ).toBe(false);
    expect(runEvidenceSchema.safeParse({ ...prePlan, status: "failed" }).success).toBe(false);
  });

  it("rejects unsupported schema versions and non-opaque run identifiers", () => {
    const base = completedEvidence();
    expect(runEvidenceSchema.safeParse({ ...base, schemaVersion: "2.0.0" }).success).toBe(false);
    expect(runEvidenceSchema.safeParse({ ...base, runId: "judge-demo" }).success).toBe(false);
    expect(
      runEvidenceSchema.safeParse({ ...base, runId: "00000000-0000-4000-8000-000000000001" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown top-level and nested fields", () => {
    const base = completedEvidence();
    expect(runEvidenceSchema.safeParse({ ...base, question: "sensitive sentinel" }).success).toBe(
      false,
    );
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        metrics: { ...base.metrics, rawError: "sensitive sentinel" },
      }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        modelEvidence: {
          ...base.modelEvidence!,
          target: { ...base.modelEvidence!.target, endpoint: "http://remote.invalid" },
        },
      }).success,
    ).toBe(false);
  });

  it("requires exactly nine timeline entries", () => {
    const base = completedEvidence();
    expect(
      runEvidenceSchema.safeParse({ ...base, timeline: base.timeline.slice(0, 8) }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({ ...base, timeline: [...base.timeline, base.timeline[8]!] })
        .success,
    ).toBe(false);
  });

  it("requires canonical timeline sequence, node identity, and order", () => {
    const base = completedEvidence();
    const wrongSequence = base.timeline.map((entry, index) =>
      index === 0 ? { ...entry, sequence: 2 } : entry,
    );
    const wrongIdentity = base.timeline.map((entry, index) =>
      index === 1 ? { ...entry, nodeId: "retrieval" } : entry,
    );
    const wrongOrder = [...base.timeline];
    [wrongOrder[0], wrongOrder[1]] = [wrongOrder[1]!, wrongOrder[0]!];
    expect(runEvidenceSchema.safeParse({ ...base, timeline: wrongSequence }).success).toBe(false);
    expect(runEvidenceSchema.safeParse({ ...base, timeline: wrongIdentity }).success).toBe(false);
    expect(runEvidenceSchema.safeParse({ ...base, timeline: wrongOrder }).success).toBe(false);
  });

  it("restricts outcomes and never permits the database to pass or execute", () => {
    const base = completedEvidence();
    const passedDatabase = base.timeline.map((entry, index) =>
      index === 8 ? { ...entry, outcome: "passed" } : entry,
    );
    const executedDatabase = base.timeline.map((entry, index) =>
      index === 8 ? { ...entry, outcome: "executed" } : entry,
    );
    expect(runEvidenceSchema.safeParse({ ...base, timeline: passedDatabase }).success).toBe(false);
    expect(runEvidenceSchema.safeParse({ ...base, timeline: executedDatabase }).success).toBe(
      false,
    );
  });

  it("requires optional sections exactly when their stages were reached", () => {
    const base = completedEvidence();
    for (const key of [
      "inputGuardrailDecision",
      "retrievalEvidence",
      "modelEvidence",
      "outputGuardrailDecision",
      "evaluatorResults",
    ] as const) {
      const changed = { ...base };
      delete changed[key];
      expect(runEvidenceSchema.safeParse(changed).success).toBe(false);
    }
    expect(
      runEvidenceSchema.safeParse({
        ...prePlanEvidence("blocked", "REQUEST_INVALID"),
        inputGuardrailDecision: inputPassed,
      }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        inputGuardrailDecision: {
          ...base.inputGuardrailDecision!,
          status: "blocked",
          code: "INSTRUCTION_OVERRIDE",
          explanation: DIAGNOSTIC_EXPLANATIONS.INSTRUCTION_OVERRIDE,
        },
      }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        retrievalEvidence: {
          ...base.retrievalEvidence!,
          code: "INPUT_GUARDRAIL_PASSED",
          explanation: DIAGNOSTIC_EXPLANATIONS.INPUT_GUARDRAIL_PASSED,
        },
      }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        outputGuardrailDecision: {
          ...base.outputGuardrailDecision!,
          status: "blocked",
          code: "CITATION_REQUIRED",
          explanation: DIAGNOSTIC_EXPLANATIONS.CITATION_REQUIRED,
        },
      }).success,
    ).toBe(false);
  });

  it("reconciles model invocation and observed metadata with the timeline", () => {
    const base = completedEvidence();
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        modelEvidence: { ...base.modelEvidence!, invocationReached: false },
      }).success,
    ).toBe(false);
    const busy = busyEvidence();
    expect(runEvidenceSchema.safeParse(busy).success).toBe(true);
    expect(
      runEvidenceSchema.safeParse({
        ...busy,
        modelEvidence: {
          ...busy.modelEvidence!,
          observed: { model: "ao008-fixture-model" },
        },
      }).success,
    ).toBe(false);
  });

  it("bounds and validates guardrail, retrieval, and model metadata", () => {
    const base = completedEvidence();
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        inputGuardrailDecision: {
          ...base.inputGuardrailDecision!,
          inputCharacterCount: MAX_RUN_EVIDENCE_INPUT_CHARACTERS,
          maximumInputCharacters: MAX_RUN_EVIDENCE_INPUT_CHARACTERS,
        },
      }).success,
    ).toBe(true);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        inputGuardrailDecision: {
          ...base.inputGuardrailDecision!,
          inputCharacterCount: MAX_RUN_EVIDENCE_INPUT_CHARACTERS + 1,
        },
      }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        retrievalEvidence: {
          ...base.retrievalEvidence!,
          relevance: { minimum: 0.8, maximum: 1.1, mean: 0.9 },
        },
      }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        modelEvidence: {
          ...base.modelEvidence!,
          observed: { runtimeVersion: "http://host/path" },
        },
      }).success,
    ).toBe(false);
  });

  it("requires finite bounded reconciled metrics and literal security controls", () => {
    const base = completedEvidence();
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        metrics: {
          ...base.metrics,
          usage: {
            inputTokens: 10_000_000,
            outputTokens: 10_000_000,
            totalTokens: 20_000_000,
          },
        },
      }).success,
    ).toBe(true);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        metrics: {
          ...base.metrics,
          usage: { inputTokens: 40, outputTokens: 10, totalTokens: 49 },
        },
      }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        metrics: {
          ...base.metrics,
          usage: { inputTokens: 10_000_001, outputTokens: 0, totalTokens: 10_000_001 },
        },
      }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        metrics: { ...base.metrics, totalDurationMs: Number.POSITIVE_INFINITY },
      }).success,
    ).toBe(false);
    expect(
      runEvidenceSchema.safeParse({
        ...base,
        securityControls: { ...base.securityControls, databaseOpened: true },
      }).success,
    ).toBe(false);
  });

  it("serializes deterministically with sorted keys while preserving array order and unique run IDs", () => {
    const first = runEvidenceSchema.parse(completedEvidence());
    const second = runEvidenceSchema.parse(completedEvidence(OTHER_RUN_ID));
    const serialized = serializeRunEvidence(first);
    expect(serializeRunEvidence(first)).toBe(serialized);
    expect(serialized.indexOf('"code"')).toBeLessThan(serialized.indexOf('"explanation"'));
    expect(
      (JSON.parse(serialized) as { timeline: Array<{ sequence: number }> }).timeline.map(
        (entry) => entry.sequence,
      ),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(serializeRunEvidence(second)).not.toBe(serialized);
    expect(serialized).not.toContain("timestamp");
    expect(serialized).not.toContain("sensitive sentinel");
  });
});
