import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CURRENT_WORKFLOW_SCHEMA_VERSION,
  SUPPORTED_NODE_TYPES,
  WorkflowSchema,
} from "./workflow-schema";

const templatePath = resolve(process.cwd(), "templates", "enterprise-rag.v1.json");

function readTemplate(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(templatePath, "utf8"));

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Enterprise RAG fixture must contain a JSON object.");
  }

  return structuredClone(parsed as Record<string, unknown>);
}

function nodesOf(workflow: Record<string, unknown>): Array<Record<string, unknown>> {
  return workflow.nodes as Array<Record<string, unknown>>;
}

function edgesOf(workflow: Record<string, unknown>): Array<Record<string, unknown>> {
  return workflow.edges as Array<Record<string, unknown>>;
}

describe("WorkflowSchema", () => {
  it("parses the Enterprise RAG fixture as valid JSON and a strict workflow", () => {
    const workflow = readTemplate();
    const result = WorkflowSchema.safeParse(workflow);

    expect(result.success).toBe(true);
    expect(workflow.schemaVersion).toBe(CURRENT_WORKFLOW_SCHEMA_VERSION);
  });

  it("covers every supported node type in the Enterprise RAG fixture", () => {
    const nodeTypes = nodesOf(readTemplate()).map((node) => node.type);

    expect(new Set(nodeTypes)).toEqual(new Set(SUPPORTED_NODE_TYPES));
  });

  it("rejects an unknown root property", () => {
    const workflow = readTemplate();
    workflow.unexpected = true;

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects an unknown node property", () => {
    const workflow = readTemplate();
    nodesOf(workflow)[0]!.unexpected = true;

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects an unknown node configuration property", () => {
    const workflow = readTemplate();
    const configuration = nodesOf(workflow)[0]!.configuration as Record<string, unknown>;
    configuration.unexpected = true;

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects an unknown edge property", () => {
    const workflow = readTemplate();
    edgesOf(workflow)[0]!.unexpected = true;

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects unknown policy, evaluation, and deployment properties", () => {
    const workflow = readTemplate();
    (workflow.policies as Record<string, unknown>).unexpected = true;
    (workflow.evaluation as Record<string, unknown>).unexpected = true;
    (workflow.deployment as Record<string, unknown>).unexpected = true;

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects an unknown node type", () => {
    const workflow = readTemplate();
    nodesOf(workflow)[0]!.type = "unknown_node";

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects an unknown schema version", () => {
    const workflow = readTemplate();
    workflow.schemaVersion = "2.0.0";

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const workflow = readTemplate();
    delete workflow.description;

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects a non-finite node position", () => {
    const workflow = readTemplate();
    const position = nodesOf(workflow)[0]!.position as Record<string, unknown>;
    position.x = Number.POSITIVE_INFINITY;

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects an invalid data classification", () => {
    const workflow = readTemplate();
    const security = nodesOf(workflow)[0]!.security as Record<string, unknown>;
    security.dataClassification = "secret";

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects an invalid environment-variable reference", () => {
    const workflow = readTemplate();
    const databaseNode = nodesOf(workflow).find((node) => node.type === "relational_database")!;
    const configuration = databaseNode.configuration as Record<string, unknown>;
    const connectionReference = configuration.connectionReference as Record<string, unknown>;
    connectionReference.environmentVariableName = "database-url";

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects evaluation thresholds outside zero through one", () => {
    const workflow = readTemplate();
    const evaluation = workflow.evaluation as Record<string, unknown>;
    const thresholds = evaluation.metricThresholds as Record<string, unknown>;
    thresholds.groundedness = 1.01;

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects non-positive execution limits", () => {
    const workflow = readTemplate();
    const policies = workflow.policies as Record<string, unknown>;
    const limits = policies.executionLimits as Record<string, unknown>;
    limits.maximumSteps = 0;

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });

  it("rejects an executable claim for the relational database", () => {
    const workflow = readTemplate();
    const databaseNode = nodesOf(workflow).find((node) => node.type === "relational_database")!;
    databaseNode.implementationStatus = "executable";

    expect(WorkflowSchema.safeParse(workflow).success).toBe(false);
  });
});
