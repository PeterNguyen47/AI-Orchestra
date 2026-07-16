import { z } from "zod";

export const governedAnswerSchema = z
  .object({
    answerMarkdown: z
      .string()
      .trim()
      .min(1)
      .max(8_000)
      .refine((value) => !/<[^>]+>/.test(value)),
    citationIds: z.array(z.string().min(1).max(160)).max(10),
    insufficientContext: z.boolean(),
  })
  .strict();

export type GovernedAnswer = z.infer<typeof governedAnswerSchema>;
export type ProviderId = "openai-responses" | "deterministic-test";
export type DeploymentMode = "hosted_external" | "test_only";

export type ResolvedModelTarget = Readonly<{
  providerId: ProviderId;
  modelId: string;
  deploymentMode: DeploymentMode;
  capabilities: ReadonlyArray<"structured_output" | "abort_signal" | "no_tools">;
  governanceClassification: "approved_reference" | "test_only";
}>;

export type ModelRuntimeRequest = Readonly<{
  target: ResolvedModelTarget;
  instructions: string;
  untrustedContext: string;
  outputContract: typeof governedAnswerSchema;
  limits: Readonly<{ maximumOutputTokens: number; timeoutMs: number }>;
  signal: AbortSignal;
  metadata: Readonly<{ runId: string }>;
}>;

export type NormalizedUsage = Readonly<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}>;

export type ModelRuntimeResult =
  | Readonly<{
      status: "completed";
      output: GovernedAnswer;
      usage: NormalizedUsage;
      finishState: "complete";
    }>
  | Readonly<{
      status: "refused";
      refusalCode: "provider_refusal";
      usage: NormalizedUsage;
      finishState: "refused";
    }>;

export interface ModelExecutionAdapter {
  readonly providerId: ProviderId;
  execute(request: ModelRuntimeRequest): Promise<ModelRuntimeResult>;
}

export class ModelAdapterRegistry {
  readonly #adapters = new Map<ProviderId, ModelExecutionAdapter>();

  register(adapter: ModelExecutionAdapter): this {
    if (this.#adapters.has(adapter.providerId)) throw new Error("MODEL_ADAPTER_DUPLICATE");
    this.#adapters.set(adapter.providerId, adapter);
    return this;
  }

  resolve(target: ResolvedModelTarget): ModelExecutionAdapter {
    const adapter = this.#adapters.get(target.providerId);
    if (!adapter) throw new Error("MODEL_ADAPTER_UNAVAILABLE");
    return adapter;
  }
}

export const OPENAI_GPT56_TARGET: ResolvedModelTarget = Object.freeze({
  providerId: "openai-responses",
  modelId: "gpt-5.6",
  deploymentMode: "hosted_external",
  capabilities: ["structured_output", "abort_signal", "no_tools"] as const,
  governanceClassification: "approved_reference",
});

export const DETERMINISTIC_TEST_TARGET: ResolvedModelTarget = Object.freeze({
  providerId: "deterministic-test",
  modelId: "ao007-fixture-model",
  deploymentMode: "test_only",
  capabilities: ["structured_output", "abort_signal", "no_tools"] as const,
  governanceClassification: "test_only",
});
