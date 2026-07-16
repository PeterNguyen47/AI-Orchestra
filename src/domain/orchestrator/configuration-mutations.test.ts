import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMMON_CONFIGURATION_FIELDS,
  NODE_CONFIGURATION_FIELD_CATALOG,
  READ_ONLY_NODE_FIELDS,
  configurationFieldsFor,
} from "./configuration-field-catalog";
import {
  updateWorkflowNodeConfiguration,
  type EditableNodePayload,
} from "./configuration-mutations";
import { getSafeEditableDefaults } from "./node-factory";
import { parseWorkflowJson, serializeWorkflow } from "@/domain/workflow/workflow-parser";
import { SUPPORTED_NODE_TYPES } from "@/domain/workflow/workflow-schema";
import type { Workflow, WorkflowNode } from "@/domain/workflow/workflow-types";

function template(): Workflow {
  const parsed = parseWorkflowJson(
    readFileSync(resolve("templates/enterprise-rag.v1.json"), "utf8"),
  );
  if (!parsed.success) throw new Error("Invalid test template.");
  return structuredClone(parsed.data);
}

function editable(node: WorkflowNode): EditableNodePayload {
  return structuredClone({
    label: node.label,
    description: node.description,
    security: node.security,
    documentationRef: node.documentationRef,
    configuration: node.configuration,
  }) as EditableNodePayload;
}

describe("configuration catalog, safe defaults, and atomic mutation", () => {
  it("exhaustively describes all nine node types and protected boundaries", () => {
    expect(Object.keys(NODE_CONFIGURATION_FIELD_CATALOG)).toEqual([...SUPPORTED_NODE_TYPES]);
    expect(COMMON_CONFIGURATION_FIELDS).toHaveLength(5);
    expect(READ_ONLY_NODE_FIELDS.map((field) => field.key)).toEqual([
      "id",
      "type",
      "implementationStatus",
      "position",
      "ports",
    ]);
    for (const type of SUPPORTED_NODE_TYPES) {
      for (const field of configurationFieldsFor(type)) {
        expect(field.key).toBeTruthy();
        expect(field.label).toBeTruthy();
        expect(field.help).toBeTruthy();
        expect(field.constraint).toBeTruthy();
        expect(field.required).toBe(true);
      }
    }
  });

  it("restores factory-backed safe editable defaults for every node type", () => {
    const workflow = template();
    for (const type of SUPPORTED_NODE_TYPES) {
      const node = workflow.nodes.find((candidate) => candidate.type === type)!;
      const result = updateWorkflowNodeConfiguration(
        workflow,
        node.id,
        getSafeEditableDefaults(workflow, type),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const updated = result.workflow.nodes.find((candidate) => candidate.id === node.id)!;
        expect(updated.id).toBe(node.id);
        expect(updated.type).toBe(node.type);
        expect(updated.implementationStatus).toBe(node.implementationStatus);
        expect(updated.position).toEqual(node.position);
        expect(updated.ports).toEqual(node.ports);
        expect(result.workflow.edges).toEqual(workflow.edges);
      }
    }
  });

  it("applies a valid complete payload and preserves protected fields and edges", () => {
    const workflow = template();
    const node = workflow.nodes.find((candidate) => candidate.type === "retrieval")!;
    if (node.type !== "retrieval") throw new Error("Expected retrieval node.");
    const payload = editable(node);
    (payload.configuration as { topK: number }).topK = 12;
    const result = updateWorkflowNodeConfiguration(workflow, node.id, payload);
    expect(result.success).toBe(true);
    if (result.success) {
      const updated = result.workflow.nodes.find((candidate) => candidate.id === node.id)!;
      expect(updated.type === "retrieval" && updated.configuration.topK).toBe(12);
      expect(updated.id).toBe(node.id);
      expect(updated.position).toEqual(node.position);
      expect(updated.ports).toEqual(node.ports);
      expect(result.workflow.edges).toEqual(workflow.edges);
    }
  });

  it("rejects out-of-range and unknown configuration atomically with stable field errors", () => {
    const workflow = template();
    const before = serializeWorkflow(workflow);
    const node = workflow.nodes.find((candidate) => candidate.type === "retrieval")!;
    if (node.type !== "retrieval") throw new Error("Expected retrieval node.");
    const below = editable(node);
    (below.configuration as { topK: number }).topK = 0;
    const rejected = updateWorkflowNodeConfiguration(workflow, node.id, below);
    expect(rejected.success).toBe(false);
    if (!rejected.success) {
      expect(rejected.workflow).toBe(workflow);
      expect(rejected.fieldErrors["configuration.topK"]).toBeTruthy();
    }
    const unknown = editable(node) as unknown as Record<string, unknown>;
    (unknown.configuration as Record<string, unknown>).unexpected = true;
    expect(
      updateWorkflowNodeConfiguration(workflow, node.id, unknown as unknown as EditableNodePayload)
        .success,
    ).toBe(false);
    expect(serializeWorkflow(workflow)).toBe(before);
  });

  it("accepts numeric minima and maxima and rejects values outside each declared bound", () => {
    const workflow = template();
    for (const node of workflow.nodes) {
      const numeric = configurationFieldsFor(node.type).filter(
        (field) => field.minimum !== undefined && field.maximum !== undefined,
      );
      for (const field of numeric) {
        const key = field.key.replace("configuration.", "");
        if (key.includes(".")) continue;
        for (const value of [field.minimum!, field.maximum!]) {
          const payload = editable(node);
          (payload.configuration as unknown as Record<string, unknown>)[key] = value;
          expect(updateWorkflowNodeConfiguration(workflow, node.id, payload).success).toBe(true);
        }
        for (const value of [field.minimum! - 1, field.maximum! + 1]) {
          const payload = editable(node);
          (payload.configuration as unknown as Record<string, unknown>)[key] = value;
          expect(updateWorkflowNodeConfiguration(workflow, node.id, payload).success).toBe(false);
        }
      }
    }
  });
});
