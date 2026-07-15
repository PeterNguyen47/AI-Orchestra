import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NODE_CATALOG, getNodeCatalogEntry, humanizeNodeType } from "./node-catalog";
import { createWorkflowNode } from "./node-factory";
import { parseWorkflowJson } from "@/domain/workflow/workflow-parser";
import type { Workflow } from "@/domain/workflow/workflow-types";

function template(): Workflow {
  const parsed = parseWorkflowJson(
    readFileSync(resolve("templates/enterprise-rag.v1.json"), "utf8"),
  );
  if (!parsed.success) throw new Error("Invalid test template.");
  return parsed.data;
}

describe("node catalog and factory", () => {
  it("covers every supported type with human-readable metadata", () => {
    expect(NODE_CATALOG).toHaveLength(9);
    for (const entry of NODE_CATALOG) {
      expect(getNodeCatalogEntry(entry.type)).toBe(entry);
      expect(humanizeNodeType(entry.type)).toBe(entry.label);
    }
    expect(() => getNodeCatalogEntry("unsupported" as never)).toThrow("Unsupported node type");
  });

  it("creates every node type through a structurally validated canonical prototype", () => {
    const workflow = template();
    NODE_CATALOG.forEach((entry, index) => {
      const node = createWorkflowNode(workflow, entry.type, () => `test-node-${index}`, {
        x: 10,
        y: 20,
      });
      expect(node.id).toBe(`test-node-${index}`);
      expect(node.position).toEqual({ x: 10, y: 20 });
      expect(node.ports.map((port) => port.id).length).toBe(
        new Set(node.ports.map((port) => port.id)).size,
      );
      expect(node.implementationStatus).toBe(
        entry.type === "relational_database" ? "simulated" : "roadmap",
      );
    });
  });

  it("fails closed when a prototype or generated ID is invalid", () => {
    expect(() =>
      createWorkflowNode({ ...template(), nodes: [] }, "user_input", () => "id", { x: 0, y: 0 }),
    ).toThrow("no prototype");
    expect(() =>
      createWorkflowNode(template(), "user_input", () => "INVALID ID", { x: 0, y: 0 }),
    ).toThrow("invalid canonical");
  });
});
