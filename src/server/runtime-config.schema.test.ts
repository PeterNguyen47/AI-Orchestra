import { describe, expect, it } from "vitest";
import { parseLoopbackHttpUrl, parseRuntimeConfig } from "./runtime-config.schema";

describe("parseRuntimeConfig", () => {
  it("provides non-sensitive local defaults", () => {
    expect(parseRuntimeConfig({})).toEqual({
      appName: "AI Orchestra",
      appVersion: "0.1.0",
      logLevel: "info",
      nodeEnvironment: "development",
      port: 3000,
      executionMode: "disabled",
      executionConfigured: false,
      localExecutionEnabled: false,
      judgeFixtureEnabled: false,
      ollamaBaseUrl: "http://127.0.0.1:11434",
      localModel: "qwen3:4b",
      localTimeoutMs: 120_000,
      localMaximumOutputTokens: 1_024,
      optionalOpenAiConfigured: false,
      maximumTotalTokens: 12_000,
      maximumConcurrentRuns: 2,
    });
  });
  it("parses bounded local settings without an API key", () => {
    const config = parseRuntimeConfig({
      AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED: "true",
      OLLAMA_BASE_URL: "http://localhost:11434/",
      AI_ORCHESTRA_LOCAL_MODEL: "qwen3:4b",
      AI_ORCHESTRA_LOCAL_TIMEOUT_MS: "15000",
      AI_ORCHESTRA_LOCAL_MAX_OUTPUT_TOKENS: "128",
    });
    expect(config).toMatchObject({
      executionMode: "ollama_local",
      executionConfigured: true,
      localExecutionEnabled: true,
      judgeFixtureEnabled: false,
      ollamaBaseUrl: "http://localhost:11434",
      localTimeoutMs: 15_000,
      localMaximumOutputTokens: 128,
    });
    expect(config.openAiApiKey).toBeUndefined();
  });
  it.each(["0", "65536", "not-a-port"])("rejects invalid port %s", (port) =>
    expect(() => parseRuntimeConfig({ PORT: port })).toThrow(),
  );
  it("keeps OpenAI optional and disabled unless both future gates exist", () => {
    expect(
      parseRuntimeConfig({ OPENAI_API_KEY: "fixture-placeholder" }).optionalOpenAiConfigured,
    ).toBe(false);
    const config = parseRuntimeConfig({
      AI_ORCHESTRA_OPENAI_EXECUTION_ENABLED: "true",
      OPENAI_API_KEY: "fixture-placeholder",
    });
    expect(config.optionalOpenAiConfigured).toBe(true);
    expect(config.executionConfigured).toBe(false);
  });
  it("selects explicit Ollama mode while retaining legacy local enablement", () => {
    expect(parseRuntimeConfig({ AI_ORCHESTRA_EXECUTION_MODE: "ollama_local" })).toMatchObject({
      executionMode: "ollama_local",
      executionConfigured: true,
      localExecutionEnabled: true,
      judgeFixtureEnabled: false,
    });
    expect(parseRuntimeConfig({ AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED: "true" })).toMatchObject({
      executionMode: "ollama_local",
      localExecutionEnabled: true,
    });
  });
  it("selects provider-free judge mode without Ollama configuration", () => {
    expect(
      parseRuntimeConfig({
        AI_ORCHESTRA_EXECUTION_MODE: "judge_fixture",
        OLLAMA_BASE_URL: "https://not-used.invalid/path",
      }),
    ).toMatchObject({
      executionMode: "judge_fixture",
      executionConfigured: true,
      localExecutionEnabled: false,
      judgeFixtureEnabled: true,
      ollamaBaseUrl: "http://127.0.0.1:11434",
    });
  });
  it("rejects contradictory explicit execution modes", () => {
    for (const source of [
      {
        AI_ORCHESTRA_EXECUTION_MODE: "judge_fixture",
        AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED: "true",
      },
      {
        AI_ORCHESTRA_EXECUTION_MODE: "judge_fixture",
        AI_ORCHESTRA_OPENAI_EXECUTION_ENABLED: "true",
      },
      {
        AI_ORCHESTRA_EXECUTION_MODE: "disabled",
        AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED: "true",
      },
    ] as const) {
      expect(() => parseRuntimeConfig(source)).toThrow("EXECUTION_MODE_CONFLICT");
    }
  });
  it.each(["http://127.0.0.1:11434", "http://localhost:11434", "http://[::1]:11434"])(
    "accepts loopback URL %s",
    (url) => expect(parseLoopbackHttpUrl(url)).toBe(url),
  );
  it.each([
    "https://127.0.0.1:11434",
    "http://example.com:11434",
    "http://user:pass@localhost:11434",
    "http://localhost:11434/api",
    "http://localhost:11434?x=1",
    "http://localhost:11434/#x",
  ])("rejects unsafe local URL %s", (url) =>
    expect(() => parseLoopbackHttpUrl(url)).toThrow("OLLAMA_BASE_URL_INVALID"),
  );
});
