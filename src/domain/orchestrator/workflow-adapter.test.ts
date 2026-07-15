import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWorkflowJson } from "@/domain/workflow/workflow-parser";
import type { Workflow } from "@/domain/workflow/workflow-types";
import {
  workflowEdgeAriaLabel,
  workflowNodeAriaLabel,
  workflowToCanvasEdges,
  workflowToCanvasNodes,
} from "./workflow-adapter";

function template(): Workflow {
  const parsed = parseWorkflowJson(
    readFileSync(resolve("templates/enterprise-rag.v1.json"), "utf8"),
  );
  if (!parsed.success) throw new Error("Invalid test template.");
  return parsed.data;
}

describe("workflow canvas adapter", () => {
  it("maps all canonical nodes without changing domain positions or statuses", () => {
    const workflow = template();
    const nodes = workflowToCanvasNodes(workflow);
    expect(nodes).toHaveLength(9);
    expect(nodes.map((node) => node.position)).toEqual(workflow.nodes.map((node) => node.position));
    expect(nodes.map((node) => node.data.workflowNode.implementationStatus)).toEqual(
      workflow.nodes.map((node) => node.implementationStatus),
    );
    expect(nodes.every((node) => node.type === "workflowNode" && node.focusable)).toBe(true);
    expect(workflowNodeAriaLabel(workflow.nodes[0]!)).toContain("executable");
  });

  it("maps seven solid runtime edges and one dashed advisory edge", () => {
    const workflow = template();
    const edges = workflowToCanvasEdges(workflow);
    expect(edges).toHaveLength(8);
    expect(edges.filter((edge) => edge.data?.workflowEdge.mode === "runtime")).toHaveLength(7);
    expect(edges.filter((edge) => edge.style?.strokeDasharray)).toHaveLength(1);
    expect(workflowEdgeAriaLabel(workflow.edges.at(-1)!)).toContain("advisory");
  });
});
