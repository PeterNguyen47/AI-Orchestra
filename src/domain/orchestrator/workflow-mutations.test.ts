import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addWorkflowNode,
  deleteWorkflowEdge,
  deleteWorkflowNode,
  moveWorkflowNode,
  resetWorkflow,
} from "./workflow-mutations";
import { parseWorkflowJson, serializeWorkflow } from "@/domain/workflow/workflow-parser";
import type { Workflow } from "@/domain/workflow/workflow-types";

function template(): Workflow {
  const parsed = parseWorkflowJson(
    readFileSync(resolve("templates/enterprise-rag.v1.json"), "utf8"),
  );
  if (!parsed.success) throw new Error("Invalid test template.");
  return parsed.data;
}

describe("atomic workflow mutations", () => {
  it("moves only the selected node position", () => {
    const workflow = template();
    const result = moveWorkflowNode(workflow, "user-input", { x: 42, y: 84 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.workflow.nodes[0]?.position).toEqual({ x: 42, y: 84 });
      expect({ ...result.workflow.nodes[0], position: workflow.nodes[0]?.position }).toEqual(
        workflow.nodes[0],
      );
      expect(result.workflow.edges).toEqual(workflow.edges);
    }
  });

  it("adds a deterministic roadmap node and a simulated database", () => {
    const roadmap = addWorkflowNode(template(), "retrieval", () => "node-added", { x: 1, y: 2 });
    const simulated = addWorkflowNode(template(), "relational_database", () => "database-added", {
      x: 3,
      y: 4,
    });
    expect(roadmap.success && roadmap.workflow.nodes.at(-1)?.implementationStatus).toBe("roadmap");
    expect(simulated.success && simulated.workflow.nodes.at(-1)?.implementationStatus).toBe(
      "simulated",
    );
  });

  it("deletes a node and all incident edges atomically", () => {
    const result = deleteWorkflowNode(template(), "retrieval");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.workflow.nodes.some((node) => node.id === "retrieval")).toBe(false);
      expect(
        result.workflow.edges.some(
          (edge) => edge.sourceNodeId === "retrieval" || edge.targetNodeId === "retrieval",
        ),
      ).toBe(false);
      expect(result.findingCount).toBeGreaterThan(0);
    }
  });

  it("deletes an edge without changing nodes", () => {
    const workflow = template();
    const result = deleteWorkflowEdge(workflow, workflow.edges[0]!.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.workflow.nodes).toEqual(workflow.nodes);
  });

  it("rejects missing targets and invalid additions without mutating prior state", () => {
    const workflow = template();
    expect(moveWorkflowNode(workflow, "missing", { x: 0, y: 0 }).success).toBe(false);
    expect(deleteWorkflowNode(workflow, "missing").success).toBe(false);
    expect(deleteWorkflowEdge(workflow, "missing").success).toBe(false);
    expect(
      addWorkflowNode(workflow, "user_input", () => "INVALID ID", { x: 0, y: 0 }).success,
    ).toBe(false);
    expect(workflow.nodes).toHaveLength(9);
    expect(workflow.edges).toHaveLength(8);
  });

  it("resets to byte-equivalent canonical domain content", () => {
    const workflow = template();
    const result = resetWorkflow(workflow);
    expect(result.success).toBe(true);
    if (result.success)
      expect(serializeWorkflow(result.workflow)).toBe(serializeWorkflow(workflow));
  });
});
