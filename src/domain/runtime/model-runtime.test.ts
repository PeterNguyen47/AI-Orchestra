import { describe, expect, it } from "vitest";
import {
  AO011_JUDGE_FIXTURE_TARGET,
  DETERMINISTIC_TEST_TARGET,
  ModelAdapterRegistry,
  OPENAI_GPT56_TARGET,
  governedAnswerSchema,
  type ModelExecutionAdapter,
} from "./model-runtime";

const adapter = {
  providerId: "openai-responses",
  execute: async () => {
    throw new Error("unused");
  },
} satisfies ModelExecutionAdapter;

describe("model runtime contracts", () => {
  it("registers and resolves one approved adapter", () => {
    expect(new ModelAdapterRegistry().register(adapter).resolve(OPENAI_GPT56_TARGET)).toBe(adapter);
  });

  it("rejects duplicate and unavailable adapters", () => {
    const registry = new ModelAdapterRegistry().register(adapter);
    expect(() => registry.register(adapter)).toThrow("MODEL_ADAPTER_DUPLICATE");
    expect(() => new ModelAdapterRegistry().resolve(OPENAI_GPT56_TARGET)).toThrow(
      "MODEL_ADAPTER_UNAVAILABLE",
    );
  });

  it("rejects raw HTML in structured answers", () => {
    expect(() =>
      governedAnswerSchema.parse({
        answerMarkdown: "<b>unsafe</b>",
        citationIds: [],
        insufficientContext: true,
      }),
    ).toThrow();
  });

  it("defines the separate AO-011 provider-free test-only target", () => {
    expect(AO011_JUDGE_FIXTURE_TARGET).toEqual({
      providerId: "deterministic-test",
      modelId: "ao011-judge-fixture",
      deploymentMode: "test_only",
      capabilities: ["structured_output", "abort_signal", "no_tools"],
      governanceClassification: "test_only",
    });
  });

  it("keeps the AO-007 and AO-011 deterministic targets distinct", () => {
    expect(AO011_JUDGE_FIXTURE_TARGET).not.toBe(DETERMINISTIC_TEST_TARGET);
    expect(AO011_JUDGE_FIXTURE_TARGET.modelId).not.toBe(DETERMINISTIC_TEST_TARGET.modelId);
    expect(DETERMINISTIC_TEST_TARGET.modelId).toBe("ao007-fixture-model");
  });
});
