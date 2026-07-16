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

  it("returns only the safe not-configured state without a live key and flag", async () => {
    getRuntimeConfig.mockReturnValue({ executionConfigured: false });
    await expect(
      runGovernedRagAction({ workflow: {}, question: "question", creditAcknowledged: true }),
    ).resolves.toEqual({
      status: "not-configured",
      code: "LIVE_EXECUTION_NOT_CONFIGURED",
      databaseAccess: "not_opened_or_queried",
    });
  });

  it("rejects incomplete browser requests after authentication", async () => {
    await expect(runGovernedRagAction({ workflow: {}, question: "question" })).resolves.toEqual({
      status: "blocked",
      code: "REQUEST_INVALID",
      databaseAccess: "not_opened_or_queried",
    });
  });
});
