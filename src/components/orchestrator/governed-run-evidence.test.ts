import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EVALUATOR_EXPLANATIONS } from "@/domain/runtime/evaluations";
import {
  CANONICAL_TIMELINE,
  DIAGNOSTIC_EXPLANATIONS,
  runEvidenceSchema,
  type TimelineOutcome,
} from "@/domain/runtime/run-evidence";
import { GovernedRunEvidence } from "./governed-run-evidence";

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

const modelTarget = {
  provider: "ollama-local",
  model: "qwen3:4b",
  deploymentMode: "local_machine",
} as const;

function timeline(outcomes: ReadonlyArray<TimelineOutcome>) {
  return CANONICAL_TIMELINE.map((entry, index) => ({
    ...entry,
    outcome: outcomes[index],
  }));
}

function completedEvidence() {
  return runEvidenceSchema.parse({
    schemaVersion: "1.0.0",
    runId: "run_00000000-0000-4000-8000-000000000008",
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
    inputGuardrailDecision: {
      status: "passed",
      code: "INPUT_GUARDRAIL_PASSED",
      explanation: DIAGNOSTIC_EXPLANATIONS.INPUT_GUARDRAIL_PASSED,
      inputCharacterCount: 85,
      maximumInputCharacters: 4_000,
      promptInjectionDetectionEnabled: true,
    },
    retrievalEvidence: {
      status: "passed",
      code: "RETRIEVAL_COMPLETED",
      explanation: DIAGNOSTIC_EXPLANATIONS.RETRIEVAL_COMPLETED,
      requestedTopK: 5,
      returnedChunkCount: 1,
      minimumRelevanceThreshold: 0.72,
      maximumContextCharacters: 24_000,
      relevance: { minimum: 0.888889, maximum: 0.888889, mean: 0.888889 },
    },
    modelEvidence: {
      target: modelTarget,
      observed: {
        model: "qwen3:4b",
        modelDigest: "sha256:fixture",
        runtime: "Ollama",
        runtimeVersion: "ao008-e2e-fixture-1.0.0",
      },
      invocationReached: true,
      toolsUsed: false,
      thinkingUsed: false,
      handoffsUsed: false,
      persistenceUsed: false,
    },
    outputGuardrailDecision: {
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
    },
    evaluatorResults: [
      {
        evaluatorId: "citation_coverage.v1",
        status: "passed",
        score: 1,
        threshold: 0.9,
        explanation: EVALUATOR_EXPLANATIONS["citation_coverage.v1"].passed,
      },
      {
        evaluatorId: "retrieval_relevance.v1",
        status: "passed",
        score: 0.888889,
        threshold: 0.750001,
        explanation: EVALUATOR_EXPLANATIONS["retrieval_relevance.v1"].passed,
      },
      {
        evaluatorId: "structural_grounding.v1",
        status: "passed",
        score: 1,
        threshold: 0.8,
        explanation: EVALUATOR_EXPLANATIONS["structural_grounding.v1"].passed,
      },
    ],
    metrics: {
      totalDurationMs: 90,
      providerDurationMs: 75,
      usage: { inputTokens: 40, outputTokens: 10, totalTokens: 50 },
      estimatedCostUsd: 0.000001,
      externalApiCostUsd: 0.000001,
      localComputeCostMeasured: false,
    },
    securityControls,
  });
}

function blockedEvidence() {
  return runEvidenceSchema.parse({
    schemaVersion: "1.0.0",
    runId: "run_00000000-0000-4000-8000-000000000009",
    status: "blocked",
    code: "INSTRUCTION_OVERRIDE",
    explanation: DIAGNOSTIC_EXPLANATIONS.INSTRUCTION_OVERRIDE,
    timeline: timeline([
      "passed",
      "blocked",
      "skipped",
      "skipped",
      "skipped",
      "skipped",
      "skipped",
      "skipped",
      "simulated",
    ]),
    inputGuardrailDecision: {
      status: "blocked",
      code: "INSTRUCTION_OVERRIDE",
      explanation: DIAGNOSTIC_EXPLANATIONS.INSTRUCTION_OVERRIDE,
      inputCharacterCount: 76,
      maximumInputCharacters: 4_000,
      promptInjectionDetectionEnabled: true,
    },
    modelEvidence: {
      target: modelTarget,
      invocationReached: false,
      toolsUsed: false,
      thinkingUsed: false,
      handoffsUsed: false,
      persistenceUsed: false,
    },
    metrics: {
      totalDurationMs: 2,
      estimatedCostUsd: 0,
      externalApiCostUsd: 0,
      localComputeCostMeasured: false,
    },
    securityControls,
  });
}

function notConfiguredEvidence() {
  return runEvidenceSchema.parse({
    schemaVersion: "1.0.0",
    runId: "run_00000000-0000-4000-8000-000000000010",
    status: "not-configured",
    code: "LOCAL_EXECUTION_NOT_ENABLED",
    explanation: DIAGNOSTIC_EXPLANATIONS.LOCAL_EXECUTION_NOT_ENABLED,
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
      totalDurationMs: 1,
      estimatedCostUsd: 0,
      externalApiCostUsd: 0,
      localComputeCostMeasured: false,
    },
    securityControls,
  });
}

describe("GovernedRunEvidence", () => {
  it("renders the canonical success timeline, decisions, evaluators, metrics, and simulated database", () => {
    const html = renderToStaticMarkup(
      createElement(GovernedRunEvidence, { evidence: completedEvidence() }),
    );

    expect(html).toContain("<ol");
    expect(html.match(/data-stage-id=/g)).toHaveLength(9);
    let previousIndex = -1;
    for (const entry of CANONICAL_TIMELINE) {
      const index = html.indexOf(`data-stage-id="${entry.nodeId}"`);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
    expect(html).toContain('data-stage-id="user-input" data-stage-outcome="passed"');
    expect(html).toContain('data-testid="input-guardrail-decision"');
    expect(html).toContain('data-testid="output-guardrail-decision"');
    expect(html.match(/data-evaluator-id=/g)).toHaveLength(3);
    expect(html).toContain(EVALUATOR_EXPLANATIONS["citation_coverage.v1"].passed);
    expect(html).toContain("Provider duration</dt><dd>75 ms");
    expect(html).toContain("Total tokens</dt><dd>50");
    expect(html).toContain("Mean relevance</dt><dd>0.888889");
    expect(html).toContain("Threshold</dt><dd>0.750001");
    expect(html).toContain("External API cost</dt><dd>$0.000001");
    expect(html).toContain("Simulated relational database");
    expect(html).toContain("It was not opened or queried.");
    expect(html).not.toContain("FIXTURE ANSWER MUST STAY OUTSIDE DIAGNOSTICS");
  });

  it("retains passed and blocked stages while omitting unreached result cards and sensitive input", () => {
    const html = renderToStaticMarkup(
      createElement(GovernedRunEvidence, { evidence: blockedEvidence() }),
    );

    expect(html).toContain('data-stage-id="user-input" data-stage-outcome="passed"');
    expect(html).toContain('data-stage-id="input-guardrail" data-stage-outcome="blocked"');
    expect(html).toContain('data-stage-id="document-source" data-stage-outcome="skipped"');
    expect(html).toContain(DIAGNOSTIC_EXPLANATIONS.INSTRUCTION_OVERRIDE);
    expect(html).toContain('data-testid="input-guardrail-decision"');
    expect(html).not.toContain('data-testid="output-guardrail-decision"');
    expect(html).not.toContain('data-testid="evaluator-results"');
    expect(html).not.toContain("authorization: Bearer [AO008-SENSITIVE-SENTINEL]");
  });

  it("uses semantic evidence structures and a distinct skipped-database callout", () => {
    const html = renderToStaticMarkup(
      createElement(GovernedRunEvidence, { evidence: notConfiguredEvidence() }),
    );

    expect(html).toContain('aria-labelledby="governed-run-evidence-title"');
    expect(html).toContain('data-testid="run-evidence-timeline"');
    expect(html).toContain("<ol");
    expect(html).toContain("<dl");
    expect(html).toContain('role="note"');
    expect(html).toContain("Relational database skipped");
    expect(html).toContain("The database node was skipped for this run.");
    expect(html.match(/Status: Not started/g)).toHaveLength(8);
    expect(html).not.toContain('data-testid="model-evidence"');
  });
});
