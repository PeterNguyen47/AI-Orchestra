import { describe, expect, it } from "vitest";
import { loadEnterpriseRagWorkflow } from "./load-enterprise-rag";

describe("Enterprise RAG server loader", () => {
  it("returns only structurally and semantically valid serializable workflow data", () => {
    const result = loadEnterpriseRagWorkflow();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.findingCount).toBe(0);
      expect(result.workflow.nodes).toHaveLength(9);
      expect(result.workflow.edges).toHaveLength(8);
      expect(() => JSON.stringify(result.workflow)).not.toThrow();
    }
  });
});
