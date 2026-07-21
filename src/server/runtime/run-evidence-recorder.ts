import "server-only";

import { randomUUID } from "node:crypto";
import {
  CANONICAL_TIMELINE,
  getDiagnosticExplanation,
  runEvidenceSchema,
  type DiagnosticCode,
  type RunEvidence,
  type RunEvidenceInput,
  type TimelineNodeId,
  type TimelineNodeType,
  type TimelineOutcome,
} from "@/domain/runtime/run-evidence";

const DATABASE_NODE_ID = "simulated-relational-database" satisfies TimelineNodeId;
const MAX_TOTAL_DURATION_MS = 86_400_000;
const SAFE_METADATA_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:+-]*$/;

type InputGuardrailDecisionInput = NonNullable<RunEvidenceInput["inputGuardrailDecision"]>;
type RetrievalEvidenceInput = NonNullable<RunEvidenceInput["retrievalEvidence"]>;
type ModelEvidenceInput = NonNullable<RunEvidenceInput["modelEvidence"]>;
type OutputGuardrailDecisionInput = NonNullable<RunEvidenceInput["outputGuardrailDecision"]>;
type EvaluatorResultsInput = NonNullable<RunEvidenceInput["evaluatorResults"]>;
type MetricsInput = RunEvidenceInput["metrics"];
type RecordedMetricsInput = Omit<MetricsInput, "totalDurationMs" | "localComputeCostMeasured">;
type MutableTimelineEntry = {
  sequence: number;
  nodeId: TimelineNodeId;
  nodeType: TimelineNodeType;
  outcome: TimelineOutcome;
};

export type RunEvidenceTerminal = Readonly<
  Pick<RunEvidenceInput, "status"> & { code: DiagnosticCode }
>;

export type RunEvidenceRecorderOptions = Readonly<{
  runIdFactory?: () => string;
  clock?: () => number;
}>;

const defaultRunIdFactory = () => `run_${randomUUID()}`;
const defaultClock = () => performance.now();

const SECURITY_CONTROLS: RunEvidenceInput["securityControls"] = Object.freeze({
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
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function safeDuration(startedAt: number, finishedAt: number): number {
  const elapsed = finishedAt - startedAt;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  return Math.min(MAX_TOTAL_DURATION_MS, Math.round(elapsed));
}

function safeMetadata<T extends string>(
  value: T | undefined,
  maximumLength: number,
): T | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > maximumLength ||
    !SAFE_METADATA_PATTERN.test(normalized)
  )
    return undefined;
  return normalized as T;
}

function sanitizeModelEvidence(input: ModelEvidenceInput): ModelEvidenceInput | undefined {
  const provider = safeMetadata(input.target.provider, 64);
  const model = safeMetadata(input.target.model, 160);
  if (!provider || !model) return undefined;

  const observedModel = safeMetadata(input.observed?.model, 160);
  const modelDigest = safeMetadata(input.observed?.modelDigest, 200);
  const runtime = safeMetadata(input.observed?.runtime, 80);
  const runtimeVersion = safeMetadata(input.observed?.runtimeVersion, 80);
  const hasObservedMetadata = Boolean(observedModel || modelDigest || runtime || runtimeVersion);

  return {
    target: { provider, model, deploymentMode: input.target.deploymentMode },
    ...(hasObservedMetadata
      ? {
          observed: {
            ...(observedModel ? { model: observedModel } : {}),
            ...(modelDigest ? { modelDigest } : {}),
            ...(runtime ? { runtime } : {}),
            ...(runtimeVersion ? { runtimeVersion } : {}),
          },
        }
      : {}),
    invocationReached: input.invocationReached,
    toolsUsed: false,
    thinkingUsed: false,
    handoffsUsed: false,
    persistenceUsed: false,
  };
}

export class RunEvidenceRecorder {
  readonly #runId: string;
  readonly #clock: () => number;
  readonly #startedAt: number;
  readonly #timeline: MutableTimelineEntry[];
  #inputGuardrailDecision: InputGuardrailDecisionInput | undefined;
  #retrievalEvidence: RetrievalEvidenceInput | undefined;
  #modelEvidence: ModelEvidenceInput | undefined;
  #outputGuardrailDecision: OutputGuardrailDecisionInput | undefined;
  #evaluatorResults: EvaluatorResultsInput | undefined;
  #recordedMetrics: Partial<RecordedMetricsInput> = {};
  #terminal = false;

  constructor(options: RunEvidenceRecorderOptions = {}) {
    this.#runId = (options.runIdFactory ?? defaultRunIdFactory)();
    this.#clock = options.clock ?? defaultClock;
    this.#startedAt = this.#clock();
    this.#timeline = CANONICAL_TIMELINE.map((entry) => ({
      ...entry,
      outcome: entry.nodeId === DATABASE_NODE_ID ? "skipped" : "not-started",
    }));
  }

  get runId(): string {
    return this.#runId;
  }

  #assertMutable(): void {
    if (this.#terminal) throw new Error("RUN_EVIDENCE_ALREADY_FINALIZED");
  }

  #entryIndex(nodeId: TimelineNodeId): number {
    const index = this.#timeline.findIndex((entry) => entry.nodeId === nodeId);
    if (index < 0) throw new Error("RUN_EVIDENCE_UNKNOWN_STAGE");
    return index;
  }

  #transition(nodeId: TimelineNodeId, outcome: TimelineOutcome): this {
    this.#assertMutable();
    const index = this.#entryIndex(nodeId);
    const current = this.#timeline[index]!;

    if (nodeId === DATABASE_NODE_ID) {
      if (outcome !== "simulated" || current.outcome !== "skipped")
        throw new Error("RUN_EVIDENCE_ILLEGAL_TRANSITION");
    } else {
      if (outcome === "simulated" || outcome === "not-started" || current.outcome !== "not-started")
        throw new Error("RUN_EVIDENCE_ILLEGAL_TRANSITION");
      if (outcome !== "skipped") {
        const earlierExecutableStages = this.#timeline.slice(0, index);
        if (earlierExecutableStages.some((entry) => entry.outcome !== "passed"))
          throw new Error("RUN_EVIDENCE_ILLEGAL_TRANSITION");
      }
    }

    this.#timeline[index] = { ...current, outcome };
    return this;
  }

  passStage(nodeId: TimelineNodeId): this {
    return this.#transition(nodeId, "passed");
  }

  blockStage(nodeId: TimelineNodeId): this {
    return this.#transition(nodeId, "blocked");
  }

  failStage(nodeId: TimelineNodeId): this {
    return this.#transition(nodeId, "failed");
  }

  simulateStage(nodeId: TimelineNodeId = DATABASE_NODE_ID): this {
    return this.#transition(nodeId, "simulated");
  }

  skipStage(nodeId: TimelineNodeId): this {
    return this.#transition(nodeId, "skipped");
  }

  markPlanValid(target?: ModelEvidenceInput["target"]): this {
    this.simulateStage(DATABASE_NODE_ID);
    if (!target) return this;
    return this.recordModelEvidence({
      target,
      invocationReached: false,
      toolsUsed: false,
      thinkingUsed: false,
      handoffsUsed: false,
      persistenceUsed: false,
    });
  }

  skipRemainingAfter(nodeId: TimelineNodeId): this {
    this.#assertMutable();
    const index = this.#entryIndex(nodeId);
    for (const entry of this.#timeline.slice(index + 1)) {
      if (entry.nodeId !== DATABASE_NODE_ID && entry.outcome === "not-started")
        this.skipStage(entry.nodeId);
    }
    return this;
  }

  recordInputGuardrailDecision(decision: InputGuardrailDecisionInput): this {
    this.#assertMutable();
    this.#inputGuardrailDecision = { ...decision };
    return this;
  }

  recordRetrievalEvidence(evidence: RetrievalEvidenceInput): this {
    this.#assertMutable();
    this.#retrievalEvidence = { ...evidence };
    return this;
  }

  recordModelEvidence(evidence: ModelEvidenceInput): this {
    this.#assertMutable();
    this.#modelEvidence = sanitizeModelEvidence(evidence);
    return this;
  }

  recordOutputGuardrailDecision(decision: OutputGuardrailDecisionInput): this {
    this.#assertMutable();
    this.#outputGuardrailDecision = { ...decision };
    return this;
  }

  recordEvaluatorResults(results: EvaluatorResultsInput): this {
    this.#assertMutable();
    this.#evaluatorResults = results;
    return this;
  }

  recordMetrics(metrics: Partial<RecordedMetricsInput>): this {
    this.#assertMutable();
    this.#recordedMetrics = {
      ...this.#recordedMetrics,
      ...metrics,
      ...(metrics.usage ? { usage: { ...metrics.usage } } : {}),
    };
    return this;
  }

  finalize(terminal: RunEvidenceTerminal): RunEvidence {
    this.#assertMutable();
    this.#terminal = true;
    const candidate: RunEvidenceInput = {
      schemaVersion: "1.0.0",
      runId: this.#runId,
      ...terminal,
      explanation: getDiagnosticExplanation(terminal.code),
      timeline: this.#timeline,
      ...(this.#inputGuardrailDecision
        ? { inputGuardrailDecision: this.#inputGuardrailDecision }
        : {}),
      ...(this.#retrievalEvidence ? { retrievalEvidence: this.#retrievalEvidence } : {}),
      ...(this.#modelEvidence ? { modelEvidence: this.#modelEvidence } : {}),
      ...(this.#outputGuardrailDecision
        ? { outputGuardrailDecision: this.#outputGuardrailDecision }
        : {}),
      ...(this.#evaluatorResults ? { evaluatorResults: this.#evaluatorResults } : {}),
      metrics: {
        ...this.#recordedMetrics,
        totalDurationMs: safeDuration(this.#startedAt, this.#clock()),
        estimatedCostUsd: this.#recordedMetrics.estimatedCostUsd ?? 0,
        externalApiCostUsd: this.#recordedMetrics.externalApiCostUsd ?? 0,
        localComputeCostMeasured: false,
      },
      securityControls: SECURITY_CONTROLS,
    };
    return deepFreeze(runEvidenceSchema.parse(candidate));
  }
}

export type TrustedPreExecutionCode =
  "REQUEST_INVALID" | "RATE_LIMIT_EXCEEDED" | "LOCAL_EXECUTION_NOT_ENABLED";

const TRUSTED_PRE_EXECUTION_TERMINALS = {
  REQUEST_INVALID: {
    status: "blocked",
    code: "REQUEST_INVALID",
  },
  RATE_LIMIT_EXCEEDED: {
    status: "blocked",
    code: "RATE_LIMIT_EXCEEDED",
  },
  LOCAL_EXECUTION_NOT_ENABLED: {
    status: "not-configured",
    code: "LOCAL_EXECUTION_NOT_ENABLED",
  },
} as const satisfies Record<TrustedPreExecutionCode, RunEvidenceTerminal>;

export function createTrustedPreExecutionEvidence(
  code: TrustedPreExecutionCode,
  options: RunEvidenceRecorderOptions = {},
): RunEvidence {
  return new RunEvidenceRecorder(options).finalize(TRUSTED_PRE_EXECUTION_TERMINALS[code]);
}
