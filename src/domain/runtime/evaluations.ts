import { z } from "zod";

export const EVALUATOR_IDS = [
  "citation_coverage.v1",
  "retrieval_relevance.v1",
  "structural_grounding.v1",
] as const;

export const EVALUATOR_STATUSES = ["passed", "failed"] as const;

export const EVALUATOR_EXPLANATIONS = Object.freeze({
  "citation_coverage.v1": Object.freeze({
    passed: "Required citations use accepted retrieved identifiers.",
    failed: "Required citations do not fully use accepted retrieved identifiers.",
  }),
  "retrieval_relevance.v1": Object.freeze({
    passed: "Rounded aggregate lexical relevance meets the configured threshold.",
    failed: "Rounded aggregate lexical relevance is below the configured threshold.",
  }),
  "structural_grounding.v1": Object.freeze({
    passed: "The output passed the required schema and citation-structure checks.",
    failed: "The output did not pass the required schema and citation-structure checks.",
  }),
} as const);

const unitIntervalSchema = z.number().finite().min(0).max(1);
const explanationSchema = z.string().min(1).max(200);

export const evaluatorIdSchema = z.enum(EVALUATOR_IDS);
export const evaluatorStatusSchema = z.enum(EVALUATOR_STATUSES);

function evaluatorResultSchema<Id extends (typeof EVALUATOR_IDS)[number]>(id: Id) {
  return z
    .strictObject({
      evaluatorId: z.literal(id),
      status: evaluatorStatusSchema,
      score: unitIntervalSchema,
      threshold: unitIntervalSchema,
      explanation: explanationSchema,
    })
    .superRefine((result, context) => {
      if (result.explanation !== EVALUATOR_EXPLANATIONS[id][result.status]) {
        context.addIssue({
          code: "custom",
          path: ["explanation"],
          message: "Evaluator explanations must come from the fixed catalog.",
        });
      }
    })
    .readonly();
}

export const citationCoverageResultSchema = evaluatorResultSchema("citation_coverage.v1");
export const retrievalRelevanceResultSchema = evaluatorResultSchema("retrieval_relevance.v1");
export const structuralGroundingResultSchema = evaluatorResultSchema("structural_grounding.v1");

export const evaluatorResultSchemaUnion = z.discriminatedUnion("evaluatorId", [
  citationCoverageResultSchema,
  retrievalRelevanceResultSchema,
  structuralGroundingResultSchema,
]);

export const evaluatorResultsSchema = z
  .tuple([
    citationCoverageResultSchema,
    retrievalRelevanceResultSchema,
    structuralGroundingResultSchema,
  ])
  .readonly();

export type EvaluatorId = z.infer<typeof evaluatorIdSchema>;
export type EvaluatorStatus = z.infer<typeof evaluatorStatusSchema>;
export type EvaluatorResult = z.infer<typeof evaluatorResultSchemaUnion>;
export type EvaluatorResults = z.infer<typeof evaluatorResultsSchema>;
export type CitationCoverageResult = z.infer<typeof citationCoverageResultSchema>;
export type RetrievalRelevanceResult = z.infer<typeof retrievalRelevanceResultSchema>;
export type StructuralGroundingResult = z.infer<typeof structuralGroundingResultSchema>;

const roundedScore = (value: number): number => Number(value.toFixed(6));
const checkedUnitValue = (value: number): number => unitIntervalSchema.parse(value);

function resultStatus(score: number, threshold: number): EvaluatorStatus {
  return score >= threshold ? "passed" : "failed";
}

export function evaluateCitationCoverage(
  input: Readonly<{
    citationsRequired: boolean;
    citationIds: ReadonlyArray<string>;
    acceptedCitationIds: ReadonlySet<string>;
    threshold: number;
  }>,
): CitationCoverageResult {
  const threshold = checkedUnitValue(input.threshold);
  const citations = [...new Set(input.citationIds)];
  const acceptedCount = citations.filter((identifier) =>
    input.acceptedCitationIds.has(identifier),
  ).length;
  const score = roundedScore(
    citations.length === 0 ? (input.citationsRequired ? 0 : 1) : acceptedCount / citations.length,
  );
  const status =
    input.citationsRequired && citations.length === 0 ? "failed" : resultStatus(score, threshold);
  return citationCoverageResultSchema.parse({
    evaluatorId: "citation_coverage.v1",
    status,
    score,
    threshold,
    explanation: EVALUATOR_EXPLANATIONS["citation_coverage.v1"][status],
  });
}

export function evaluateRetrievalRelevance(
  input: Readonly<{
    meanRelevance: number;
    threshold: number;
  }>,
): RetrievalRelevanceResult {
  const score = roundedScore(checkedUnitValue(input.meanRelevance));
  const threshold = checkedUnitValue(input.threshold);
  const status = resultStatus(score, threshold);
  return retrievalRelevanceResultSchema.parse({
    evaluatorId: "retrieval_relevance.v1",
    status,
    score,
    threshold,
    explanation: EVALUATOR_EXPLANATIONS["retrieval_relevance.v1"][status],
  });
}

export function evaluateStructuralGrounding(
  input: Readonly<{
    outputSchemaValid: boolean;
    citationStructureValid: boolean;
    threshold: number;
  }>,
): StructuralGroundingResult {
  const threshold = checkedUnitValue(input.threshold);
  const score = input.outputSchemaValid && input.citationStructureValid ? 1 : 0;
  const status =
    input.outputSchemaValid && input.citationStructureValid
      ? resultStatus(score, threshold)
      : "failed";
  return structuralGroundingResultSchema.parse({
    evaluatorId: "structural_grounding.v1",
    status,
    score,
    threshold,
    explanation: EVALUATOR_EXPLANATIONS["structural_grounding.v1"][status],
  });
}

export function runDeterministicEvaluators(
  input: Readonly<{
    citationsRequired: boolean;
    citationIds: ReadonlyArray<string>;
    acceptedCitationIds: ReadonlySet<string>;
    meanRelevance: number;
    outputSchemaValid: boolean;
    citationStructureValid: boolean;
    thresholds: Readonly<{
      citationCoverage: number;
      retrievalRelevance: number;
      structuralGrounding: number;
    }>;
  }>,
): EvaluatorResults {
  return evaluatorResultsSchema.parse([
    evaluateCitationCoverage({
      citationsRequired: input.citationsRequired,
      citationIds: input.citationIds,
      acceptedCitationIds: input.acceptedCitationIds,
      threshold: input.thresholds.citationCoverage,
    }),
    evaluateRetrievalRelevance({
      meanRelevance: input.meanRelevance,
      threshold: input.thresholds.retrievalRelevance,
    }),
    evaluateStructuralGrounding({
      outputSchemaValid: input.outputSchemaValid,
      citationStructureValid: input.citationStructureValid,
      threshold: input.thresholds.structuralGrounding,
    }),
  ]);
}
