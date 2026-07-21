import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRuntimeConfig, loggerInfo } = vi.hoisted(() => ({
  getRuntimeConfig: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/server/runtime-config", () => ({ getRuntimeConfig }));
vi.mock("@/server/logger", () => ({ logger: { info: loggerInfo } }));

import { GET } from "./route";

describe("health route", () => {
  beforeEach(() => {
    loggerInfo.mockReset();
    getRuntimeConfig.mockReturnValue({
      appName: "AI Orchestra",
      appVersion: "0.1.0",
      nodeEnvironment: "synthetic-environment-sentinel",
      ollamaBaseUrl: "http://127.0.0.1:11434",
      localModel: "synthetic-model-sentinel",
    });
  });

  it("returns only the allowlisted health fields with no-store caching", async () => {
    const response = GET();
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["service", "status", "timestamp", "version"]);
    expect(body).toMatchObject({ status: "ok", service: "AI Orchestra", version: "0.1.0" });
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("logs only status and excludes runtime configuration values", async () => {
    const body = await GET().json();
    expect(loggerInfo).toHaveBeenCalledWith("health_check", { status: "ok" });
    const serialized = JSON.stringify({ body, calls: loggerInfo.mock.calls });
    expect(serialized).not.toContain("synthetic-environment-sentinel");
    expect(serialized).not.toContain("synthetic-model-sentinel");
    expect(serialized).not.toContain("127.0.0.1");
  });
});
