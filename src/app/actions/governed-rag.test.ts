import { beforeEach, describe, expect, it, vi } from "vitest";
const { requireSession, getRuntimeConfig } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getRuntimeConfig: vi.fn(),
}));
vi.mock("@/server/auth/authorization", () => ({ requireSession }));
vi.mock("@/server/runtime-config", () => ({ getRuntimeConfig }));
import { runGovernedRagAction } from "./governed-rag";

describe("runGovernedRagAction", () => {
  beforeEach(() => {
    requireSession.mockReset();
    getRuntimeConfig.mockReset();
    requireSession.mockResolvedValue({ sub: "judge-demo" });
  });
  it("requires authentication before validating the request", async () => {
    requireSession.mockRejectedValue(new Error("AUTH_REQUIRED"));
    await expect(runGovernedRagAction({})).rejects.toThrow("AUTH_REQUIRED");
    expect(getRuntimeConfig).not.toHaveBeenCalled();
  });
  it("returns the safe disabled state without requiring a cloud key", async () => {
    getRuntimeConfig.mockReturnValue({ localExecutionEnabled: false });
    await expect(runGovernedRagAction({ workflow: {}, question: "question" })).resolves.toEqual({
      status: "not-configured",
      code: "LOCAL_EXECUTION_NOT_ENABLED",
      databaseAccess: "not_opened_or_queried",
    });
  });
  it.each([
    { provider: "openai-responses" },
    { model: "gpt-5.6" },
    { endpoint: "http://example.com" },
    { creditAcknowledged: true },
  ])("rejects browser override fields %#", async (extra) => {
    await expect(
      runGovernedRagAction({ workflow: {}, question: "question", ...extra }),
    ).resolves.toEqual({
      status: "blocked",
      code: "REQUEST_INVALID",
      databaseAccess: "not_opened_or_queried",
    });
    expect(getRuntimeConfig).not.toHaveBeenCalled();
  });
});
