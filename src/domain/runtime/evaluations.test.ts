import { describe, expect, it } from "vitest";
import {
  EVALUATOR_EXPLANATIONS,
  citationCoverageResultSchema,
  evaluateCitationCoverage,
  evaluateRetrievalRelevance,
  evaluateStructuralGrounding,
  evaluatorResultsSchema,
  retrievalRelevanceResultSchema,
  runDeterministicEvaluators,
  structuralGroundingResultSchema,
} from "./evaluations";

describe("deterministic AO-008 evaluators", () => {
  it("passes citation coverage when every required citation identifier is accepted", () => {
    const result = evaluateCitationCoverage({
      citationsRequired: true,
      citationIds: ["source-a#chunk-001", "source-b#chunk-002"],
      acceptedCitationIds: new Set(["source-a#chunk-001", "source-b#chunk-002"]),
      threshold: 0.9,
    });
    expect(result).toEqual({
      evaluatorId: "citation_coverage.v1",
      status: "passed",
      score: 1,
      threshold: 0.9,
      explanation: EVALUATOR_EXPLANATIONS["citation_coverage.v1"].passed,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("fails missing or unaccepted required citations and treats optional empty citations as covered", () => {
    const partial = evaluateCitationCoverage({
      citationsRequired: true,
      citationIds: ["accepted", "unknown"],
      acceptedCitationIds: new Set(["accepted"]),
      threshold: 0.75,
    });
    const missing = evaluateCitationCoverage({
      citationsRequired: true,
      citationIds: [],
      acceptedCitationIds: new Set(),
      threshold: 0,
    });
    const optional = evaluateCitationCoverage({
      citationsRequired: false,
      citationIds: [],
      acceptedCitationIds: new Set(),
      threshold: 1,
    });
    expect(partial).toMatchObject({ status: "failed", score: 0.5 });
    expect(missing).toMatchObject({ status: "failed", score: 0 });
    expect(optional).toMatchObject({ status: "passed", score: 1 });
  });

  it("uses the rounded aggregate lexical relevance and configured threshold", () => {
    const passed = evaluateRetrievalRelevance({ meanRelevance: 0.75555555, threshold: 0.75 });
    const failed = evaluateRetrievalRelevance({ meanRelevance: 0.74999949, threshold: 0.75 });
    expect(passed).toEqual({
      evaluatorId: "retrieval_relevance.v1",
      status: "passed",
      score: 0.755556,
      threshold: 0.75,
      explanation: EVALUATOR_EXPLANATIONS["retrieval_relevance.v1"].passed,
    });
    expect(failed).toMatchObject({
      status: "failed",
      score: 0.749999,
      explanation: EVALUATOR_EXPLANATIONS["retrieval_relevance.v1"].failed,
    });
  });

  it("measures structural schema and citation shape without broader truth claims", () => {
    const passed = evaluateStructuralGrounding({
      outputSchemaValid: true,
      citationStructureValid: true,
      threshold: 0.8,
    });
    const schemaFailed = evaluateStructuralGrounding({
      outputSchemaValid: false,
      citationStructureValid: true,
      threshold: 0,
    });
    const citationsFailed = evaluateStructuralGrounding({
      outputSchemaValid: true,
      citationStructureValid: false,
      threshold: 0.8,
    });
    expect(passed).toMatchObject({ status: "passed", score: 1 });
    expect(schemaFailed).toMatchObject({ status: "failed", score: 0 });
    expect(citationsFailed).toMatchObject({ status: "failed", score: 0 });
    const serialized = JSON.stringify([passed, schemaFailed, citationsFailed]).toLowerCase();
    for (const unsupportedClaim of [
      "factual truth",
      "semantic correctness",
      "legal compliance",
      "certification",
      "human review",
    ])
      expect(serialized).not.toContain(unsupportedClaim);
  });

  it("returns an immutable canonical tuple without mutating evaluator inputs", () => {
    const citationIds = ["source#chunk-001"];
    const acceptedCitationIds = new Set(citationIds);
    const result = runDeterministicEvaluators({
      citationsRequired: true,
      citationIds,
      acceptedCitationIds,
      meanRelevance: 0.9,
      outputSchemaValid: true,
      citationStructureValid: true,
      thresholds: {
        citationCoverage: 0.9,
        retrievalRelevance: 0.75,
        structuralGrounding: 0.8,
      },
    });
    expect(result.map((entry) => entry.evaluatorId)).toEqual([
      "citation_coverage.v1",
      "retrieval_relevance.v1",
      "structural_grounding.v1",
    ]);
    expect(result.map((entry) => entry.status)).toEqual(["passed", "passed", "passed"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(citationIds).toEqual(["source#chunk-001"]);
    expect([...acceptedCitationIds]).toEqual(["source#chunk-001"]);
  });

  it("rejects out-of-range inputs, reordered results, unknown fields, and non-catalog explanations", () => {
    expect(() => evaluateRetrievalRelevance({ meanRelevance: -0.1, threshold: 0.75 })).toThrow();
    expect(() =>
      evaluateStructuralGrounding({
        outputSchemaValid: true,
        citationStructureValid: true,
        threshold: Number.NaN,
      }),
    ).toThrow();
    const valid = runDeterministicEvaluators({
      citationsRequired: true,
      citationIds: ["accepted"],
      acceptedCitationIds: new Set(["accepted"]),
      meanRelevance: 1,
      outputSchemaValid: true,
      citationStructureValid: true,
      thresholds: {
        citationCoverage: 1,
        retrievalRelevance: 1,
        structuralGrounding: 1,
      },
    });
    expect(evaluatorResultsSchema.safeParse([valid[1], valid[0], valid[2]]).success).toBe(false);
    expect(
      citationCoverageResultSchema.safeParse({ ...valid[0], rawPrompt: "sensitive" }).success,
    ).toBe(false);
    expect(
      retrievalRelevanceResultSchema.safeParse({
        ...valid[1],
        explanation: "A model-authored explanation.",
      }).success,
    ).toBe(false);
    expect(structuralGroundingResultSchema.safeParse({ ...valid[2], score: 2 }).success).toBe(
      false,
    );
  });
});
