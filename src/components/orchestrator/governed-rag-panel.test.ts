import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/governed-rag", () => ({ runGovernedRagAction: vi.fn() }));

import { getExecutionPresentation } from "./governed-rag-panel";

describe("getExecutionPresentation", () => {
  it("labels judge mode as provider-free deterministic infrastructure", () => {
    const presentation = getExecutionPresentation("judge_fixture");
    expect(presentation.provider).toBe("Provider-free deterministic judge fixture");
    expect(presentation.deploymentBoundary).toBe("test-only in-process generation boundary");
    expect(presentation.provider).not.toContain("Ollama");
  });

  it("states that judge mode is neither Ollama nor live model inference", () => {
    const presentation = getExecutionPresentation("judge_fixture");
    expect(presentation.truthfulness).toContain("not Ollama");
    expect(presentation.truthfulness).toContain("not live model inference");
    expect(presentation.truthfulness).toContain("substitutes only the generation boundary");
  });

  it("labels judge token and timing facts as synthetic evidence", () => {
    const presentation = getExecutionPresentation("judge_fixture");
    expect(presentation.syntheticEvidenceNotice).toContain("fixed synthetic evidence");
    expect(presentation.submitLabel).toBe("Run provider-free governed judge path");
  });

  it("preserves the separate optional live Ollama presentation", () => {
    const presentation = getExecutionPresentation("ollama_local");
    expect(presentation.heading).toBe("Governed Local Open-Model Execution");
    expect(presentation.provider).toBe("Local Ollama");
    expect(presentation.model).toBe("Qwen3 4B");
    expect(presentation.truthfulness).toContain("loopback-only Ollama qwen3:4b");
  });
});
