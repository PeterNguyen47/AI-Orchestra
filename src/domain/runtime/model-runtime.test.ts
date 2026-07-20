import { describe, expect, it } from "vitest";
import {
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
});
