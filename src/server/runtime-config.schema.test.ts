import { describe, expect, it } from "vitest";

import { parseRuntimeConfig } from "./runtime-config.schema";

describe("parseRuntimeConfig", () => {
  it("provides non-sensitive defaults", () => {
    expect(parseRuntimeConfig({})).toEqual({
      appName: "AI Orchestra",
      appVersion: "0.1.0",
      logLevel: "info",
      nodeEnvironment: "development",
      port: 3000,
    });
  });

  it("parses explicit runtime settings", () => {
    expect(
      parseRuntimeConfig({
        APP_NAME: "AI Orchestra Test",
        APP_VERSION: "0.2.0-rc.1",
        LOG_LEVEL: "debug",
        NODE_ENV: "test",
        PORT: "4100",
      }),
    ).toEqual({
      appName: "AI Orchestra Test",
      appVersion: "0.2.0-rc.1",
      logLevel: "debug",
      nodeEnvironment: "test",
      port: 4100,
    });
  });

  it.each(["0", "65536", "not-a-port"])("rejects invalid port %s", (port) => {
    expect(() => parseRuntimeConfig({ PORT: port })).toThrow();
  });

  it("does not expose unrelated secrets", () => {
    const config = parseRuntimeConfig({ OPENAI_API_KEY: "not-a-real-key" });

    expect(config).not.toHaveProperty("OPENAI_API_KEY");
    expect(config).not.toHaveProperty("openaiApiKey");
  });
});
