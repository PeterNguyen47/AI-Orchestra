import { describe, expect, it } from "vitest";
import { getEnterpriseRagDashboardSummary } from "./dashboard-summary";

describe("Enterprise RAG dashboard summary", () => {
  it("derives counts and validation from the canonical template", () => {
    expect(getEnterpriseRagDashboardSummary()).toEqual({
      schemaVersion: "1.0.0",
      nodeCount: 9,
      executableNodeCount: 8,
      simulatedNodeCount: 1,
      runtimeEdgeCount: 7,
      advisoryEdgeCount: 1,
      semanticValidationStatus: "Valid",
    });
  });
});
