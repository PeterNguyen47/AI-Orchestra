import "server-only";

import {
  AO011_JUDGE_FIXTURE_TARGET,
  SafeModelAdapterError,
  type ModelExecutionAdapter,
  type ModelRuntimeRequest,
  type ModelRuntimeResult,
  type ResolvedModelTarget,
} from "@/domain/runtime/model-runtime";

const APPROVED_CHUNK_IDENTIFIER = /\[chunk_id: ([a-z0-9][a-z0-9-]*#chunk-\d{3})\]/;

function isAo011Target(target: ResolvedModelTarget): boolean {
  return (
    target.providerId === AO011_JUDGE_FIXTURE_TARGET.providerId &&
    target.modelId === AO011_JUDGE_FIXTURE_TARGET.modelId &&
    target.deploymentMode === AO011_JUDGE_FIXTURE_TARGET.deploymentMode &&
    target.governanceClassification === AO011_JUDGE_FIXTURE_TARGET.governanceClassification &&
    target.capabilities.length === AO011_JUDGE_FIXTURE_TARGET.capabilities.length &&
    target.capabilities.every(
      (capability, index) => capability === AO011_JUDGE_FIXTURE_TARGET.capabilities[index],
    )
  );
}

export class JudgeFixtureAdapter implements ModelExecutionAdapter {
  readonly providerId = "deterministic-test" as const;
  #invocationCount = 0;

  get invocationCount(): number {
    return this.#invocationCount;
  }

  async execute(request: ModelRuntimeRequest): Promise<ModelRuntimeResult> {
    this.#invocationCount += 1;
    if (request.signal.aborted) throw new SafeModelAdapterError("EXECUTION_TIMEOUT");
    if (!isAo011Target(request.target)) throw new SafeModelAdapterError("MODEL_TARGET_UNSUPPORTED");

    const citationId = APPROVED_CHUNK_IDENTIFIER.exec(request.untrustedContext)?.[1];
    return {
      status: "completed",
      output: citationId
        ? {
            answerMarkdown:
              "AI Orchestra runs the governed Enterprise RAG path with deterministic validation, retrieval, guardrails, evidence, evaluators, citations, and two bounded exports.",
            citationIds: [citationId],
            insufficientContext: false,
          }
        : {
            answerMarkdown: "The committed context is insufficient for this bounded judge request.",
            citationIds: [],
            insufficientContext: true,
          },
      usage: { inputTokens: 128, outputTokens: 32, totalTokens: 160 },
      finishState: "complete",
      metadata: {
        model: "ao011-judge-fixture",
        runtime: "AI Orchestra deterministic judge fixture",
        runtimeVersion: "1.0.0",
        providerDurationMs: 25,
      },
    };
  }
}
