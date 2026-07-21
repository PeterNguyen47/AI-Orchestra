import { z } from "zod";
import { evaluatorResultsSchema } from "./evaluations";

export const RUN_EVIDENCE_SCHEMA_VERSION = "1.0.0" as const;
export const MAX_RUN_EVIDENCE_INPUT_CHARACTERS = 1_000_000 as const;

export const DIAGNOSTIC_EXPLANATIONS = Object.freeze({
  RUN_COMPLETED: "The governed run completed with validated evidence.",
  REQUEST_INVALID: "The request did not match the accepted server-action contract.",
  LOCAL_EXECUTION_NOT_ENABLED: "Local governed execution is not enabled on the server.",
  WORKFLOW_INVALID: "The workflow did not match the strict workflow contract.",
  WORKFLOW_NOT_READY: "Architecture readiness checks blocked execution.",
  TEMPLATE_UNSUPPORTED: "The workflow template is not supported by this runtime.",
  EXECUTABLE_NODE_CARDINALITY:
    "The executable workflow stages did not have the required cardinality.",
  RUNTIME_EDGE_MISSING: "The canonical executable path is incomplete.",
  MODEL_TARGET_UNSUPPORTED:
    "The configured model target is not supported by this governed runtime.",
  RUNTIME_PLAN_INVALID: "The compiled runtime plan did not satisfy internal invariants.",
  INPUT_GUARDRAIL_PASSED: "The input passed the configured deterministic guardrail checks.",
  INPUT_EMPTY: "The input guardrail blocked an empty question.",
  INPUT_TOO_LONG: "The input guardrail blocked a question above the configured character limit.",
  INPUT_CONTROL_CHARACTER: "The input guardrail blocked disallowed control characters.",
  INSTRUCTION_OVERRIDE: "The input guardrail blocked an instruction-override pattern.",
  PROMPT_EXTRACTION: "The input guardrail blocked a prompt-extraction pattern.",
  SECRET_EXTRACTION: "The input guardrail blocked a secret-extraction pattern.",
  CONTEXT_AS_INSTRUCTIONS:
    "The input guardrail blocked an attempt to treat retrieved data as instructions.",
  ROLE_IMPERSONATION: "The input guardrail blocked an attempt to impersonate a privileged role.",
  POLICY_BYPASS: "The input guardrail blocked an attempt to bypass governing policy.",
  TOOL_INVOCATION_ATTEMPT:
    "The input guardrail blocked an attempt to invoke a prohibited tool or action.",
  DATA_EXFILTRATION_ATTEMPT:
    "The input guardrail blocked an attempt to extract or transmit protected data.",
  ENCODED_INSTRUCTION_ATTEMPT:
    "The input guardrail blocked an encoded or separator-obfuscated instruction attempt.",
  RATE_LIMIT_EXCEEDED: "The authenticated judge path exceeded its bounded request rate.",
  EXECUTION_LIMIT_PREFLIGHT: "Pre-execution token or cost limits blocked the run.",
  DOCUMENT_SOURCE_UNAVAILABLE: "The approved bundled document source was unavailable.",
  RETRIEVAL_COMPLETED: "Deterministic bounded retrieval returned approved context.",
  RETRIEVAL_NO_MATCH: "Deterministic retrieval found no context above the configured threshold.",
  EXECUTION_BUSY: "The bounded in-memory execution concurrency limit is active.",
  MODEL_REFUSED: "The model provider returned a governed refusal.",
  TOKEN_LIMIT_EXCEEDED: "Observed token usage exceeded the governed run limit.",
  COST_LIMIT_EXCEEDED: "The estimated external API cost exceeded the governed run limit.",
  EXECUTION_TIMEOUT: "The governed model request reached its timeout.",
  PROVIDER_OUTPUT_MALFORMED:
    "The provider output could not be read as the governed result contract.",
  PROVIDER_ERROR: "The provider failed with a safely normalized error.",
  OUTPUT_GUARDRAIL_PASSED:
    "The output passed schema, citation, active-content, and sensitive-data checks.",
  OUTPUT_TOO_LONG: "The output guardrail blocked content above the character limit.",
  OUTPUT_ACTIVE_MARKUP: "The output guardrail blocked active markup.",
  OUTPUT_SENSITIVE_DATA: "The output guardrail blocked a sensitive-data pattern.",
  CITATION_DUPLICATE: "The output guardrail blocked duplicate citation identifiers.",
  CITATION_UNKNOWN: "The output guardrail blocked a citation outside the retrieved allowlist.",
  CITATION_REQUIRED: "The output guardrail blocked an answer without a required citation.",
  INSUFFICIENT_CONTEXT:
    "The output guardrail blocked a response marked as having insufficient context.",
  LOCAL_MODEL_TIMEOUT: "The local model request reached its governed timeout.",
  OLLAMA_RUNTIME_UNAVAILABLE:
    "The local Ollama runtime was unavailable at the validated loopback endpoint.",
  OLLAMA_MALFORMED_RESPONSE: "The local runtime returned a malformed response.",
  OLLAMA_METADATA_HTTP_FAILURE: "The local runtime metadata request failed safely.",
  OLLAMA_MODEL_NOT_INSTALLED: "The required qwen3:4b model is not installed.",
  OLLAMA_CHAT_REQUEST_REJECTED: "The local runtime rejected the bounded chat request.",
  OLLAMA_RUNTIME_BUSY: "The local runtime reported that it was busy.",
  OLLAMA_CHAT_RUNTIME_FAILURE: "The local runtime failed while processing the chat request.",
  OLLAMA_CHAT_HTTP_FAILURE: "The local runtime chat request failed safely.",
  OLLAMA_MODEL_IDENTITY_CONFLICT: "The observed local model identity did not match qwen3:4b.",
  OLLAMA_UNEXPECTED_TOOL_CALL: "The local model returned a prohibited tool call.",
  MODEL_OUTPUT_MALFORMED_JSON: "The model output was not valid JSON.",
  MODEL_OUTPUT_SCHEMA_INVALID: "The model output did not match the governed answer schema.",
  RUN_EVIDENCE_INVALID: "Run evidence failed closed at the server serialization boundary.",
} as const);

export type DiagnosticCode = keyof typeof DIAGNOSTIC_EXPLANATIONS;
const diagnosticCodes = Object.keys(DIAGNOSTIC_EXPLANATIONS) as [
  DiagnosticCode,
  ...DiagnosticCode[],
];
export const diagnosticCodeSchema = z.enum(diagnosticCodes);

export function getDiagnosticExplanation(code: DiagnosticCode): string {
  return DIAGNOSTIC_EXPLANATIONS[code];
}

export const TIMELINE_OUTCOMES = [
  "passed",
  "blocked",
  "failed",
  "simulated",
  "skipped",
  "not-started",
] as const;
export type TimelineOutcome = (typeof TIMELINE_OUTCOMES)[number];

export const CANONICAL_TIMELINE = [
  { sequence: 1, nodeId: "user-input", nodeType: "user_input" },
  { sequence: 2, nodeId: "input-guardrail", nodeType: "input_guardrail" },
  { sequence: 3, nodeId: "document-source", nodeType: "document_source" },
  { sequence: 4, nodeId: "retrieval", nodeType: "retrieval" },
  { sequence: 5, nodeId: "gpt-agent", nodeType: "gpt_agent" },
  { sequence: 6, nodeId: "output-guardrail", nodeType: "output_guardrail" },
  { sequence: 7, nodeId: "evaluator", nodeType: "evaluator" },
  { sequence: 8, nodeId: "response-output", nodeType: "response_output" },
  {
    sequence: 9,
    nodeId: "simulated-relational-database",
    nodeType: "relational_database",
  },
] as const;

export type TimelineNodeId = (typeof CANONICAL_TIMELINE)[number]["nodeId"];
export type TimelineNodeType = (typeof CANONICAL_TIMELINE)[number]["nodeType"];

const TERMINAL_TIMELINE_PATTERNS = {
  prePlan: [
    "not-started",
    "not-started",
    "not-started",
    "not-started",
    "not-started",
    "not-started",
    "not-started",
    "not-started",
    "skipped",
  ],
  planInternalFailure: [
    "not-started",
    "not-started",
    "not-started",
    "not-started",
    "not-started",
    "not-started",
    "not-started",
    "not-started",
    "simulated",
  ],
  inputBlock: [
    "passed",
    "blocked",
    "skipped",
    "skipped",
    "skipped",
    "skipped",
    "skipped",
    "skipped",
    "simulated",
  ],
  preflightBlock: [
    "passed",
    "passed",
    "skipped",
    "skipped",
    "skipped",
    "skipped",
    "skipped",
    "skipped",
    "simulated",
  ],
  documentSourceFailure: [
    "passed",
    "passed",
    "failed",
    "skipped",
    "skipped",
    "skipped",
    "skipped",
    "skipped",
    "simulated",
  ],
  retrievalBlock: [
    "passed",
    "passed",
    "passed",
    "blocked",
    "skipped",
    "skipped",
    "skipped",
    "skipped",
    "simulated",
  ],
  busy: [
    "passed",
    "passed",
    "passed",
    "passed",
    "not-started",
    "skipped",
    "skipped",
    "skipped",
    "simulated",
  ],
  modelFailure: [
    "passed",
    "passed",
    "passed",
    "passed",
    "failed",
    "skipped",
    "skipped",
    "skipped",
    "simulated",
  ],
  postGenerationFailure: [
    "passed",
    "passed",
    "passed",
    "passed",
    "passed",
    "skipped",
    "skipped",
    "skipped",
    "simulated",
  ],
  outputBlock: [
    "passed",
    "passed",
    "passed",
    "passed",
    "passed",
    "blocked",
    "skipped",
    "skipped",
    "simulated",
  ],
  completed: [
    "passed",
    "passed",
    "passed",
    "passed",
    "passed",
    "passed",
    "passed",
    "passed",
    "simulated",
  ],
} as const satisfies Record<string, ReadonlyArray<TimelineOutcome>>;

const PRE_PLAN_BLOCK_CODES = [
  "REQUEST_INVALID",
  "RATE_LIMIT_EXCEEDED",
  "WORKFLOW_INVALID",
  "WORKFLOW_NOT_READY",
  "TEMPLATE_UNSUPPORTED",
  "EXECUTABLE_NODE_CARDINALITY",
  "RUNTIME_EDGE_MISSING",
  "MODEL_TARGET_UNSUPPORTED",
] as const satisfies ReadonlyArray<DiagnosticCode>;

const INPUT_BLOCK_CODES = [
  "INPUT_EMPTY",
  "INPUT_TOO_LONG",
  "INPUT_CONTROL_CHARACTER",
  "INSTRUCTION_OVERRIDE",
  "PROMPT_EXTRACTION",
  "SECRET_EXTRACTION",
  "CONTEXT_AS_INSTRUCTIONS",
  "ROLE_IMPERSONATION",
  "POLICY_BYPASS",
  "TOOL_INVOCATION_ATTEMPT",
  "DATA_EXFILTRATION_ATTEMPT",
  "ENCODED_INSTRUCTION_ATTEMPT",
] as const satisfies ReadonlyArray<DiagnosticCode>;

const MODEL_FAILURE_CODES = [
  "MODEL_REFUSED",
  "EXECUTION_TIMEOUT",
  "PROVIDER_OUTPUT_MALFORMED",
  "PROVIDER_ERROR",
  "LOCAL_MODEL_TIMEOUT",
  "OLLAMA_RUNTIME_UNAVAILABLE",
  "OLLAMA_MALFORMED_RESPONSE",
  "OLLAMA_METADATA_HTTP_FAILURE",
  "OLLAMA_MODEL_NOT_INSTALLED",
  "OLLAMA_CHAT_REQUEST_REJECTED",
  "OLLAMA_RUNTIME_BUSY",
  "OLLAMA_CHAT_RUNTIME_FAILURE",
  "OLLAMA_CHAT_HTTP_FAILURE",
  "MODEL_TARGET_UNSUPPORTED",
  "OLLAMA_MODEL_IDENTITY_CONFLICT",
  "OLLAMA_UNEXPECTED_TOOL_CALL",
  "MODEL_OUTPUT_MALFORMED_JSON",
  "MODEL_OUTPUT_SCHEMA_INVALID",
] as const satisfies ReadonlyArray<DiagnosticCode>;

const POST_GENERATION_FAILURE_CODES = [
  "TOKEN_LIMIT_EXCEEDED",
  "COST_LIMIT_EXCEEDED",
] as const satisfies ReadonlyArray<DiagnosticCode>;

const OUTPUT_BLOCK_CODES = [
  "OUTPUT_TOO_LONG",
  "OUTPUT_ACTIVE_MARKUP",
  "OUTPUT_SENSITIVE_DATA",
  "CITATION_DUPLICATE",
  "CITATION_UNKNOWN",
  "CITATION_REQUIRED",
  "INSUFFICIENT_CONTEXT",
] as const satisfies ReadonlyArray<DiagnosticCode>;

function includesDiagnosticCode(
  codes: ReadonlyArray<DiagnosticCode>,
  code: DiagnosticCode,
): boolean {
  return codes.includes(code);
}

const timelineNodeIds = CANONICAL_TIMELINE.map((entry) => entry.nodeId) as [
  TimelineNodeId,
  ...TimelineNodeId[],
];
const timelineNodeTypes = CANONICAL_TIMELINE.map((entry) => entry.nodeType) as [
  TimelineNodeType,
  ...TimelineNodeType[],
];
export const timelineOutcomeSchema = z.enum(TIMELINE_OUTCOMES);
export const timelineNodeIdSchema = z.enum(timelineNodeIds);
export const timelineNodeTypeSchema = z.enum(timelineNodeTypes);

const timelineEntrySchema = z
  .strictObject({
    sequence: z.number().int().min(1).max(9),
    nodeId: timelineNodeIdSchema,
    nodeType: timelineNodeTypeSchema,
    outcome: timelineOutcomeSchema,
  })
  .readonly();

export const runTimelineSchema = z
  .array(timelineEntrySchema)
  .length(9)
  .superRefine((timeline, context) => {
    for (const [index, expected] of CANONICAL_TIMELINE.entries()) {
      const actual = timeline[index];
      if (
        actual?.sequence !== expected.sequence ||
        actual.nodeId !== expected.nodeId ||
        actual.nodeType !== expected.nodeType
      ) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "Run timeline entries must use canonical order and identity.",
        });
      }
    }
    const database = timeline[8];
    if (database && database.outcome !== "simulated" && database.outcome !== "skipped") {
      context.addIssue({
        code: "custom",
        path: [8, "outcome"],
        message: "The relational database can only be simulated or skipped.",
      });
    }
  })
  .readonly();

const fixedExplanationSchema = z.string().min(1).max(240);
const boundedTokenComponent = z.number().int().finite().nonnegative().max(10_000_000);
const boundedTokenTotal = z.number().int().finite().nonnegative().max(20_000_000);
const boundedDuration = z.number().int().finite().nonnegative().max(86_400_000);
const boundedCost = z.number().finite().nonnegative().max(1_000_000);
const unitInterval = z.number().finite().min(0).max(1);
const safeMetadata = (maximumLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximumLength)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:+-]*$/);

function requireCatalogExplanation(
  value: Readonly<{ code: DiagnosticCode; explanation: string }>,
  context: z.RefinementCtx,
): void {
  if (value.explanation !== getDiagnosticExplanation(value.code)) {
    context.addIssue({
      code: "custom",
      path: ["explanation"],
      message: "Diagnostic explanations must come from the fixed catalog.",
    });
  }
}

export const inputGuardrailDecisionSchema = z
  .strictObject({
    status: z.enum(["passed", "blocked"]),
    code: diagnosticCodeSchema,
    explanation: fixedExplanationSchema,
    inputCharacterCount: z
      .number()
      .int()
      .finite()
      .nonnegative()
      .max(MAX_RUN_EVIDENCE_INPUT_CHARACTERS),
    maximumInputCharacters: z
      .number()
      .int()
      .finite()
      .positive()
      .max(MAX_RUN_EVIDENCE_INPUT_CHARACTERS),
    promptInjectionDetectionEnabled: z.boolean(),
  })
  .superRefine(requireCatalogExplanation)
  .readonly();

export const retrievalEvidenceSchema = z
  .strictObject({
    status: z.enum(["passed", "blocked"]),
    code: diagnosticCodeSchema,
    explanation: fixedExplanationSchema,
    requestedTopK: z.number().int().finite().min(1).max(100),
    returnedChunkCount: z.number().int().finite().nonnegative().max(100),
    minimumRelevanceThreshold: unitInterval,
    maximumContextCharacters: z.number().int().finite().positive().max(1_000_000),
    relevance: z
      .strictObject({
        minimum: unitInterval,
        maximum: unitInterval,
        mean: unitInterval,
      })
      .readonly(),
  })
  .superRefine(requireCatalogExplanation)
  .readonly();

const modelTargetSchema = z
  .strictObject({
    provider: safeMetadata(64),
    model: safeMetadata(160),
    deploymentMode: z.enum(["local_machine", "hosted_external", "test_only"]),
  })
  .readonly();

const observedModelSchema = z
  .strictObject({
    model: safeMetadata(160).optional(),
    modelDigest: safeMetadata(200).optional(),
    runtime: safeMetadata(80).optional(),
    runtimeVersion: safeMetadata(80).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Observed model metadata cannot be empty.",
  })
  .readonly();

export const modelEvidenceSchema = z
  .strictObject({
    target: modelTargetSchema,
    observed: observedModelSchema.optional(),
    invocationReached: z.boolean(),
    toolsUsed: z.literal(false),
    thinkingUsed: z.literal(false),
    handoffsUsed: z.literal(false),
    persistenceUsed: z.literal(false),
  })
  .readonly();

export const outputGuardrailDecisionSchema = z
  .strictObject({
    status: z.enum(["passed", "blocked"]),
    code: diagnosticCodeSchema,
    explanation: fixedExplanationSchema,
    schemaValidated: z.boolean(),
    citationsRequired: z.boolean(),
    citationsValidated: z.boolean(),
    acceptedCitationCount: z.number().int().finite().nonnegative().max(10),
    activeContentDetected: z.boolean(),
    sensitiveDataDetected: z.boolean(),
    insufficientContext: z.boolean(),
  })
  .superRefine(requireCatalogExplanation)
  .readonly();

export const reconciledUsageSchema = z
  .strictObject({
    inputTokens: boundedTokenComponent,
    outputTokens: boundedTokenComponent,
    totalTokens: boundedTokenTotal,
  })
  .superRefine((usage, context) => {
    if (usage.totalTokens !== usage.inputTokens + usage.outputTokens) {
      context.addIssue({
        code: "custom",
        path: ["totalTokens"],
        message: "Total tokens must equal input plus output tokens.",
      });
    }
  })
  .readonly();

export const runMetricsSchema = z
  .strictObject({
    totalDurationMs: boundedDuration,
    providerDurationMs: boundedDuration.optional(),
    usage: reconciledUsageSchema.optional(),
    estimatedCostUsd: boundedCost,
    externalApiCostUsd: boundedCost,
    localComputeCostMeasured: z.literal(false),
  })
  .readonly();

export const securityControlsSchema = z
  .strictObject({
    modelCallsServerSide: z.literal(true),
    providerSelectionExposedToBrowser: z.literal(false),
    credentialsStored: z.literal(false),
    promptsStored: z.literal(false),
    rawErrorsStored: z.literal(false),
    databaseOpened: z.literal(false),
    databaseQueried: z.literal(false),
    remoteTracingUsed: z.literal(false),
    persistenceUsed: z.literal(false),
    toolsUsed: z.literal(false),
    handoffsUsed: z.literal(false),
    thinkingStored: z.literal(false),
  })
  .readonly();

export const runEvidenceStatusSchema = z.enum([
  "completed",
  "blocked",
  "failed",
  "busy",
  "not-configured",
]);

const runEvidenceBaseSchema = z
  .strictObject({
    schemaVersion: z.literal(RUN_EVIDENCE_SCHEMA_VERSION),
    runId: z.string().regex(/^run_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
    status: runEvidenceStatusSchema,
    code: diagnosticCodeSchema,
    explanation: fixedExplanationSchema,
    timeline: runTimelineSchema,
    inputGuardrailDecision: inputGuardrailDecisionSchema.optional(),
    retrievalEvidence: retrievalEvidenceSchema.optional(),
    modelEvidence: modelEvidenceSchema.optional(),
    outputGuardrailDecision: outputGuardrailDecisionSchema.optional(),
    evaluatorResults: evaluatorResultsSchema.optional(),
    metrics: runMetricsSchema,
    securityControls: securityControlsSchema,
  })
  .readonly();

function addRequiredIssue(context: z.RefinementCtx, path: PropertyKey[], message: string): void {
  context.addIssue({ code: "custom", path, message });
}

export const runEvidenceSchema = runEvidenceBaseSchema.superRefine((evidence, context) => {
  requireCatalogExplanation(evidence, context);

  if (evidence.status === "completed" && evidence.code !== "RUN_COMPLETED")
    addRequiredIssue(context, ["code"], "Completed evidence must use RUN_COMPLETED.");
  if (evidence.status !== "completed" && evidence.code === "RUN_COMPLETED")
    addRequiredIssue(context, ["code"], "RUN_COMPLETED requires completed status.");
  if (evidence.status === "busy" && evidence.code !== "EXECUTION_BUSY")
    addRequiredIssue(context, ["code"], "Busy evidence must use EXECUTION_BUSY.");
  if (evidence.status === "not-configured" && evidence.code !== "LOCAL_EXECUTION_NOT_ENABLED")
    addRequiredIssue(
      context,
      ["code"],
      "Not-configured evidence must use LOCAL_EXECUTION_NOT_ENABLED.",
    );

  const outcome = (nodeId: TimelineNodeId) =>
    evidence.timeline.find((entry) => entry.nodeId === nodeId)?.outcome;
  const inputOutcome = outcome("input-guardrail");
  const retrievalOutcome = outcome("retrieval");
  const modelOutcome = outcome("gpt-agent");
  const outputOutcome = outcome("output-guardrail");
  const evaluatorOutcome = outcome("evaluator");
  const databaseOutcome = outcome("simulated-relational-database");

  const timelineMatches = (pattern: ReadonlyArray<TimelineOutcome>) =>
    evidence.timeline.every((entry, index) => entry.outcome === pattern[index]);
  const terminalStateMatches =
    (evidence.status === "completed" &&
      evidence.code === "RUN_COMPLETED" &&
      timelineMatches(TERMINAL_TIMELINE_PATTERNS.completed)) ||
    (evidence.status === "not-configured" &&
      evidence.code === "LOCAL_EXECUTION_NOT_ENABLED" &&
      timelineMatches(TERMINAL_TIMELINE_PATTERNS.prePlan)) ||
    (evidence.status === "busy" &&
      evidence.code === "EXECUTION_BUSY" &&
      timelineMatches(TERMINAL_TIMELINE_PATTERNS.busy)) ||
    (evidence.status === "blocked" &&
      ((includesDiagnosticCode(PRE_PLAN_BLOCK_CODES, evidence.code) &&
        timelineMatches(TERMINAL_TIMELINE_PATTERNS.prePlan)) ||
        (includesDiagnosticCode(INPUT_BLOCK_CODES, evidence.code) &&
          timelineMatches(TERMINAL_TIMELINE_PATTERNS.inputBlock)) ||
        (evidence.code === "EXECUTION_LIMIT_PREFLIGHT" &&
          timelineMatches(TERMINAL_TIMELINE_PATTERNS.preflightBlock)) ||
        (evidence.code === "RETRIEVAL_NO_MATCH" &&
          timelineMatches(TERMINAL_TIMELINE_PATTERNS.retrievalBlock)))) ||
    (evidence.status === "failed" &&
      ((evidence.code === "RUN_EVIDENCE_INVALID" &&
        timelineMatches(TERMINAL_TIMELINE_PATTERNS.prePlan)) ||
        (evidence.code === "RUNTIME_PLAN_INVALID" &&
          timelineMatches(TERMINAL_TIMELINE_PATTERNS.planInternalFailure)) ||
        (evidence.code === "DOCUMENT_SOURCE_UNAVAILABLE" &&
          timelineMatches(TERMINAL_TIMELINE_PATTERNS.documentSourceFailure)) ||
        (includesDiagnosticCode(MODEL_FAILURE_CODES, evidence.code) &&
          timelineMatches(TERMINAL_TIMELINE_PATTERNS.modelFailure)) ||
        (includesDiagnosticCode(POST_GENERATION_FAILURE_CODES, evidence.code) &&
          timelineMatches(TERMINAL_TIMELINE_PATTERNS.postGenerationFailure)) ||
        (includesDiagnosticCode(OUTPUT_BLOCK_CODES, evidence.code) &&
          timelineMatches(TERMINAL_TIMELINE_PATTERNS.outputBlock))));
  if (!terminalStateMatches)
    addRequiredIssue(
      context,
      ["timeline"],
      "Overall status, diagnostic code, and stage outcomes must match a canonical terminal pattern.",
    );

  const inputReached = inputOutcome === "passed" || inputOutcome === "blocked";
  if (inputReached !== Boolean(evidence.inputGuardrailDecision))
    addRequiredIssue(
      context,
      ["inputGuardrailDecision"],
      "Input guardrail evidence is present only when the stage was reached.",
    );
  if (evidence.inputGuardrailDecision) {
    if (evidence.inputGuardrailDecision.status !== inputOutcome)
      addRequiredIssue(
        context,
        ["inputGuardrailDecision", "status"],
        "The input guardrail decision status must match its timeline outcome.",
      );
    const codeMatches =
      (inputOutcome === "passed" &&
        evidence.inputGuardrailDecision.code === "INPUT_GUARDRAIL_PASSED") ||
      (inputOutcome === "blocked" &&
        includesDiagnosticCode(INPUT_BLOCK_CODES, evidence.inputGuardrailDecision.code) &&
        evidence.code === evidence.inputGuardrailDecision.code);
    if (!codeMatches)
      addRequiredIssue(
        context,
        ["inputGuardrailDecision", "code"],
        "The input guardrail decision code must match its outcome and terminal diagnostic.",
      );
  }

  const retrievalReached = retrievalOutcome === "passed" || retrievalOutcome === "blocked";
  if (retrievalReached !== Boolean(evidence.retrievalEvidence))
    addRequiredIssue(
      context,
      ["retrievalEvidence"],
      "Retrieval evidence is present only when the stage was reached.",
    );
  if (evidence.retrievalEvidence) {
    if (evidence.retrievalEvidence.status !== retrievalOutcome)
      addRequiredIssue(
        context,
        ["retrievalEvidence", "status"],
        "The retrieval decision status must match its timeline outcome.",
      );
    const codeMatches =
      (retrievalOutcome === "passed" &&
        evidence.retrievalEvidence.code === "RETRIEVAL_COMPLETED") ||
      (retrievalOutcome === "blocked" &&
        evidence.retrievalEvidence.code === "RETRIEVAL_NO_MATCH" &&
        evidence.code === evidence.retrievalEvidence.code);
    if (!codeMatches)
      addRequiredIssue(
        context,
        ["retrievalEvidence", "code"],
        "The retrieval decision code must match its outcome and terminal diagnostic.",
      );
  }

  const outputReached = outputOutcome === "passed" || outputOutcome === "blocked";
  if (outputReached !== Boolean(evidence.outputGuardrailDecision))
    addRequiredIssue(
      context,
      ["outputGuardrailDecision"],
      "Output guardrail evidence is present only when the stage was reached.",
    );
  if (evidence.outputGuardrailDecision) {
    if (evidence.outputGuardrailDecision.status !== outputOutcome)
      addRequiredIssue(
        context,
        ["outputGuardrailDecision", "status"],
        "The output guardrail decision status must match its timeline outcome.",
      );
    const codeMatches =
      (outputOutcome === "passed" &&
        evidence.outputGuardrailDecision.code === "OUTPUT_GUARDRAIL_PASSED") ||
      (outputOutcome === "blocked" &&
        includesDiagnosticCode(OUTPUT_BLOCK_CODES, evidence.outputGuardrailDecision.code) &&
        evidence.code === evidence.outputGuardrailDecision.code);
    if (!codeMatches)
      addRequiredIssue(
        context,
        ["outputGuardrailDecision", "code"],
        "The output guardrail decision code must match its outcome and terminal diagnostic.",
      );
  }

  if ((evaluatorOutcome === "passed") !== Boolean(evidence.evaluatorResults))
    addRequiredIssue(
      context,
      ["evaluatorResults"],
      "Evaluator results are present only after the evaluator stage passes.",
    );

  if ((databaseOutcome === "simulated") !== Boolean(evidence.modelEvidence))
    addRequiredIssue(
      context,
      ["modelEvidence"],
      "Model target evidence is present only after a valid runtime plan.",
    );

  if (evidence.modelEvidence) {
    const invocationReached = modelOutcome === "passed" || modelOutcome === "failed";
    if (evidence.modelEvidence.invocationReached !== invocationReached)
      addRequiredIssue(
        context,
        ["modelEvidence", "invocationReached"],
        "Model invocation state must match the canonical timeline.",
      );
    if (!evidence.modelEvidence.invocationReached && evidence.modelEvidence.observed)
      addRequiredIssue(
        context,
        ["modelEvidence", "observed"],
        "Observed model metadata requires a reached invocation.",
      );
  }

  if (evidence.status === "completed") {
    const executableOutcomes = evidence.timeline.slice(0, 8).map((entry) => entry.outcome);
    if (
      executableOutcomes.some((stageOutcome) => stageOutcome !== "passed") ||
      databaseOutcome !== "simulated"
    )
      addRequiredIssue(
        context,
        ["timeline"],
        "Completed evidence requires eight passed stages and a simulated database.",
      );
    if (!evidence.metrics.usage)
      addRequiredIssue(context, ["metrics", "usage"], "Completed evidence requires usage.");
  }
});

export type RunEvidenceInput = z.input<typeof runEvidenceSchema>;
export type RunEvidence = z.output<typeof runEvidenceSchema>;
export type RunEvidenceStatus = z.infer<typeof runEvidenceStatusSchema>;
export type RunTimeline = z.infer<typeof runTimelineSchema>;
export type InputGuardrailDecision = z.infer<typeof inputGuardrailDecisionSchema>;
export type RetrievalEvidence = z.infer<typeof retrievalEvidenceSchema>;
export type ModelEvidence = z.infer<typeof modelEvidenceSchema>;
export type OutputGuardrailDecision = z.infer<typeof outputGuardrailDecisionSchema>;
export type ReconciledUsage = z.infer<typeof reconciledUsageSchema>;
export type RunMetrics = z.infer<typeof runMetricsSchema>;
export type SecurityControls = z.infer<typeof securityControlsSchema>;

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortJsonKeys((value as Readonly<Record<string, unknown>>)[key])]),
    );
  }
  return value;
}

export function serializeRunEvidence(evidence: RunEvidence): string {
  return JSON.stringify(sortJsonKeys(runEvidenceSchema.parse(evidence)));
}
