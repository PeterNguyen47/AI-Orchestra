import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileRuntimePlan } from "./runtime-plan";

const workflow = JSON.parse(readFileSync("templates/enterprise-rag.v1.json", "utf8"));

describe("compileRuntimePlan", () => {
  it("compiles the one approved executable path and excludes the simulated database", () => {
    const result = compileRuntimePlan(workflow);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Object.keys(result.plan.nodes)).toHaveLength(8);
    expect(result.plan.target).toMatchObject({
      providerId: "ollama-local",
      modelId: "qwen3:4b",
    });
    expect(result.plan.databaseAccess).toBe("not_opened_or_queried");
  });

  it("rejects browser-supplied model substitutions", () => {
    const changed = structuredClone(workflow);
    changed.nodes.find((node: { id: string }) => node.id === "gpt-agent").configuration.model =
      "other";
    expect(compileRuntimePlan(changed)).toMatchObject({ success: false });
  });

  it("rejects a readiness-blocked graph", () => {
    const changed = structuredClone(workflow);
    changed.edges = changed.edges.filter(
      (edge: { id: string }) => edge.id !== "retrieval-to-gpt-agent",
    );
    expect(compileRuntimePlan(changed)).toEqual({ success: false, code: "WORKFLOW_NOT_READY" });
  });

  it("rejects malformed input and unsupported templates", () => {
    expect(compileRuntimePlan({})).toEqual({ success: false, code: "WORKFLOW_INVALID" });
    const changed = structuredClone(workflow);
    changed.template.id = "other-template";
    expect(compileRuntimePlan(changed)).toEqual({ success: false, code: "TEMPLATE_UNSUPPORTED" });
  });

  it("rejects ambiguous executable node cardinality", () => {
    const changed = structuredClone(workflow);
    const duplicate = structuredClone(
      changed.nodes.find((node: { id: string }) => node.id === "user-input"),
    );
    duplicate.id = "user-input-two";
    changed.nodes.push(duplicate);
    expect(compileRuntimePlan(changed)).toMatchObject({ success: false });
  });
});
