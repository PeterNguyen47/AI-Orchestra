import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseWorkflow,
  parseWorkflowJson,
  serializeWorkflow,
  WorkflowSerializationError,
} from "./index";

const templatePath = resolve(process.cwd(), "templates", "enterprise-rag.v1.json");

function templateText(): string {
  return readFileSync(templatePath, "utf8");
}

function templateObject(): Record<string, unknown> {
  return JSON.parse(templateText()) as Record<string, unknown>;
}

describe("workflow parser and canonical serializer", () => {
  it("parses the JSON fixture through the canonical entry point", () => {
    const result = parseWorkflowJson(templateText());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workflowId).toBe("enterprise-rag-question-answer");
    }
  });

  it("returns a structured invalid-JSON result", () => {
    expect(parseWorkflowJson("{")).toEqual({
      success: false,
      issues: [{ code: "invalid_json", path: [], message: "Workflow input is not valid JSON." }],
    });
  });

  it("preserves Zod paths for structural failures", () => {
    const workflow = templateObject();
    const nodes = workflow.nodes as Array<Record<string, unknown>>;
    const configuration = nodes[0]!.configuration as Record<string, unknown>;
    configuration.unexpected = true;

    const result = parseWorkflow(workflow);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: ["nodes", 0, "configuration"] }),
      );
    }
  });

  it("does not coerce invalid values", () => {
    const workflow = templateObject();
    const policies = workflow.policies as Record<string, unknown>;
    const limits = policies.executionLimits as Record<string, unknown>;
    limits.maximumSteps = "16";

    expect(parseWorkflow(workflow).success).toBe(false);
  });

  it("serializes, reparses, and preserves the canonical workflow", () => {
    const initial = parseWorkflowJson(templateText());
    expect(initial.success).toBe(true);
    if (!initial.success) return;

    const serialized = serializeWorkflow(initial.data);
    const reparsed = parseWorkflowJson(serialized);

    expect(reparsed).toEqual(initial);
    expect(serialized.endsWith("\n")).toBe(true);
  });

  it("sorts object keys deterministically without reordering arrays", () => {
    const parsed = parseWorkflowJson(templateText());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const first = serializeWorkflow(parsed.data);
    const second = serializeWorkflow(JSON.parse(first) as unknown);

    expect(first).toBe(second);
    expect(first.indexOf('"deployment"')).toBeLessThan(first.indexOf('"description"'));
    expect(first.indexOf('"user-input"')).toBeLessThan(first.indexOf('"input-guardrail"'));
  });

  it("rejects serialization of invalid input with structured issues", () => {
    const workflow = templateObject();
    workflow.schemaVersion = "9.0.0";

    try {
      serializeWorkflow(workflow);
      throw new Error("Expected serialization to fail.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(WorkflowSerializationError);
      expect((error as WorkflowSerializationError).issues.length).toBeGreaterThan(0);
    }
  });
});
