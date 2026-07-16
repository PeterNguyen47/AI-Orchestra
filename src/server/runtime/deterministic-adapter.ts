import "server-only";

import type {
  GovernedAnswer,
  ModelExecutionAdapter,
  ModelRuntimeRequest,
  ModelRuntimeResult,
} from "@/domain/runtime/model-runtime";

export type DeterministicMode =
  | "success"
  | "timeout"
  | "refusal"
  | "malformed"
  | "missing-citation"
  | "unknown-citation"
  | "sensitive-output"
  | "provider-error"
  | "token-limit";

export class DeterministicTestAdapter implements ModelExecutionAdapter {
  readonly providerId = "deterministic-test" as const;
  calls = 0;
  constructor(readonly mode: DeterministicMode = "success") {}

  async execute(request: ModelRuntimeRequest): Promise<ModelRuntimeResult> {
    this.calls += 1;
    if (this.mode === "timeout")
      return new Promise((_, reject) =>
        request.signal.addEventListener("abort", () => reject(request.signal.reason)),
      );
    if (this.mode === "provider-error") throw new Error("fixture raw provider detail");
    if (this.mode === "refusal")
      return {
        status: "refused",
        refusalCode: "provider_refusal",
        usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
        finishState: "refused",
      };
    if (this.mode === "malformed") throw new Error("PROVIDER_OUTPUT_MALFORMED");
    const firstId = /\[chunk_id: ([^\]]+)\]/.exec(request.untrustedContext)?.[1] ?? "unknown";
    const outputs: Record<string, GovernedAnswer> = {
      success: {
        answerMarkdown:
          "AI Orchestra executes only readiness-approved runtime nodes and keeps advisory database access disabled.",
        citationIds: [firstId],
        insufficientContext: false,
      },
      "missing-citation": {
        answerMarkdown: "An unsupported answer.",
        citationIds: [],
        insufficientContext: false,
      },
      "unknown-citation": {
        answerMarkdown: "An unsupported answer.",
        citationIds: ["unknown#chunk-999"],
        insufficientContext: false,
      },
      "sensitive-output": {
        answerMarkdown: "authorization: Bearer fixture-sensitive-value",
        citationIds: [firstId],
        insufficientContext: false,
      },
      "token-limit": {
        answerMarkdown: "Token limit.",
        citationIds: [firstId],
        insufficientContext: false,
      },
    };
    return {
      status: "completed",
      output: outputs[this.mode] ?? outputs.success!,
      usage:
        this.mode === "token-limit"
          ? { inputTokens: 20_000, outputTokens: 5_000, totalTokens: 25_000 }
          : { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
      finishState: "complete",
    };
  }
}
