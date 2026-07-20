import { beforeEach, describe, expect, it, vi } from "vitest";
const { requireSession, getRuntimeConfig, executeGovernedRag, loggerInfo } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getRuntimeConfig: vi.fn(),
  executeGovernedRag: vi.fn(),
  loggerInfo: vi.fn(),
}));
vi.mock("@/server/auth/authorization", () => ({ requireSession }));
vi.mock("@/server/runtime-config", () => ({ getRuntimeConfig }));
vi.mock("@/server/runtime/executor", () => ({ executeGovernedRag }));
vi.mock("@/server/logger", () => ({ logger: { info: loggerInfo } }));
import { RunEvidenceRecorder } from "@/server/runtime/run-evidence-recorder";
import { runGovernedRagAction } from "./governed-rag";

describe("runGovernedRagAction", () => {
  beforeEach(() => {
    requireSession.mockReset();
    getRuntimeConfig.mockReset();
    executeGovernedRag.mockReset();
    loggerInfo.mockReset();
    requireSession.mockResolvedValue({ sub: "judge-demo" });
  });
  it("requires authentication before validating the request", async () => {
    requireSession.mockRejectedValue(new Error("AUTH_REQUIRED"));
    await expect(runGovernedRagAction({})).rejects.toThrow("AUTH_REQUIRED");
    expect(getRuntimeConfig).not.toHaveBeenCalled();
  });
  it("returns the safe disabled state without requiring a cloud key", async () => {
    getRuntimeConfig.mockReturnValue({ localExecutionEnabled: false });
    const result = await runGovernedRagAction({ workflow: {}, question: "question" });
    expect(result).toMatchObject({
      status: "not-configured",
      code: "LOCAL_EXECUTION_NOT_ENABLED",
      databaseAccess: "not_opened_or_queried",
      evidence: { status: "not-configured", code: "LOCAL_EXECUTION_NOT_ENABLED" },
    });
    expect(result.evidence.timeline.map((entry) => entry.outcome)).toEqual([
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "not-started",
      "skipped",
    ]);
    expect(loggerInfo).toHaveBeenCalledOnce();
  });
  it.each([
    { provider: "openai-responses" },
    { model: "gpt-5.6" },
    { endpoint: "http://example.com" },
    { creditAcknowledged: true },
  ])("rejects browser override fields %#", async (extra) => {
    const result = await runGovernedRagAction({ workflow: {}, question: "question", ...extra });
    expect(result).toMatchObject({
      status: "blocked",
      code: "REQUEST_INVALID",
      databaseAccess: "not_opened_or_queried",
      evidence: { status: "blocked", code: "REQUEST_INVALID" },
    });
    expect(getRuntimeConfig).not.toHaveBeenCalled();
  });

  it("validates configured executor evidence and logs only the safe projection", async () => {
    getRuntimeConfig.mockReturnValue({
      localExecutionEnabled: true,
      ollamaBaseUrl: "http://127.0.0.1:11434",
      localTimeoutMs: 15_000,
      maximumTotalTokens: 12_000,
      localMaximumOutputTokens: 256,
      maximumConcurrentRuns: 2,
    });
    const evidence = new RunEvidenceRecorder({
      runIdFactory: () => "run_00000000-0000-4000-8000-000000000010",
      clock: () => 0,
    }).finalize({ status: "blocked", code: "WORKFLOW_INVALID" });
    executeGovernedRag.mockResolvedValue({
      status: "blocked",
      code: "WORKFLOW_INVALID",
      databaseAccess: "not_opened_or_queried",
      evidence,
    });

    const result = await runGovernedRagAction({
      workflow: {},
      question: "AO008-ACTION-QUESTION-SENTINEL",
    });

    expect(result).toMatchObject({ status: "blocked", evidence: { code: "WORKFLOW_INVALID" } });
    expect(executeGovernedRag).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "AO008-ACTION-QUESTION-SENTINEL",
        subject: "judge-demo",
      }),
    );
    const logged = JSON.stringify(loggerInfo.mock.calls[0]?.[1]);
    expect(logged).toContain("WORKFLOW_INVALID");
    expect(logged).not.toContain("AO008-ACTION-QUESTION-SENTINEL");
    expect(logged).not.toContain("judge-demo");
  });

  it("fails closed with RUN_EVIDENCE_INVALID when executor evidence is invalid", async () => {
    getRuntimeConfig.mockReturnValue({
      localExecutionEnabled: true,
      ollamaBaseUrl: "http://127.0.0.1:11434",
      localTimeoutMs: 15_000,
      maximumTotalTokens: 12_000,
      localMaximumOutputTokens: 256,
      maximumConcurrentRuns: 2,
    });
    executeGovernedRag.mockResolvedValue({
      status: "failed",
      code: "PROVIDER_ERROR",
      databaseAccess: "not_opened_or_queried",
      evidence: { rawValidationDetail: "AO008-VALIDATION-SENTINEL" },
    } as never);

    const result = await runGovernedRagAction({ workflow: {}, question: "question" });

    expect(result).toMatchObject({
      status: "failed",
      code: "RUN_EVIDENCE_INVALID",
      evidence: { code: "RUN_EVIDENCE_INVALID" },
    });
    const logged = JSON.stringify(loggerInfo.mock.calls[0]?.[1]);
    expect(logged).not.toContain("rawValidationDetail");
    expect(logged).not.toContain("AO008-VALIDATION-SENTINEL");

    const mismatchedEvidence = new RunEvidenceRecorder({
      runIdFactory: () => "run_00000000-0000-4000-8000-000000000011",
      clock: () => 0,
    }).finalize({ status: "blocked", code: "WORKFLOW_INVALID" });
    executeGovernedRag.mockResolvedValueOnce({
      status: "failed",
      code: "PROVIDER_ERROR",
      databaseAccess: "not_opened_or_queried",
      evidence: mismatchedEvidence,
    });

    const mismatchedResult = await runGovernedRagAction({
      workflow: {},
      question: "question",
    });
    expect(mismatchedResult).toMatchObject({
      status: "failed",
      code: "RUN_EVIDENCE_INVALID",
      evidence: { code: "RUN_EVIDENCE_INVALID" },
    });
    expect(loggerInfo).toHaveBeenCalledTimes(2);
  });
});
