import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseWorkflowJson } from "./workflow-parser";
import type { Workflow } from "./workflow-types";
import {
  getRuntimeReachableNodeIds,
  validateWorkflowSemantics,
  WORKFLOW_VALIDATION_CODES,
} from "./workflow-validator";

const templatePath = resolve(process.cwd(), "templates", "enterprise-rag.v1.json");

function workflowFixture(): Workflow {
  const parsed = parseWorkflowJson(readFileSync(templatePath, "utf8"));
  if (!parsed.success) {
    throw new Error(`Enterprise RAG fixture failed to parse: ${JSON.stringify(parsed.issues)}`);
  }
  return structuredClone(parsed.data);
}

function findingCodes(workflow: Workflow): string[] {
  return validateWorkflowSemantics(workflow).findings.map((finding) => finding.code);
}

describe("workflow semantic validation", () => {
  it("accepts the Enterprise RAG fixture with zero error findings", () => {
    expect(validateWorkflowSemantics(workflowFixture())).toEqual({ valid: true, findings: [] });
  });

  it("excludes the advisory simulated database from runtime traversal", () => {
    const reachable = getRuntimeReachableNodeIds(workflowFixture());

    expect(reachable).toHaveLength(8);
    expect(reachable).toContain("user-input");
    expect(reachable).toContain("document-source");
    expect(reachable).toContain("response-output");
    expect(reachable).not.toContain("simulated-relational-database");
  });

  it("detects a duplicate node ID", () => {
    const workflow = workflowFixture();
    workflow.nodes.push(structuredClone(workflow.nodes[0]!));

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.duplicateNodeId);
  });

  it("detects a duplicate edge ID", () => {
    const workflow = workflowFixture();
    workflow.edges.push(structuredClone(workflow.edges[0]!));

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.duplicateEdgeId);
  });

  it("detects a duplicate port ID within one node", () => {
    const workflow = workflowFixture();
    workflow.nodes[0]!.ports.push(structuredClone(workflow.nodes[0]!.ports[0]!));

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.duplicatePortId);
  });

  it("detects a missing source node", () => {
    const workflow = workflowFixture();
    workflow.edges[0]!.sourceNodeId = "missing-source";

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.missingSourceNode);
  });

  it("detects a missing target node", () => {
    const workflow = workflowFixture();
    workflow.edges[0]!.targetNodeId = "missing-target";

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.missingTargetNode);
  });

  it("detects missing source and target ports", () => {
    const workflow = workflowFixture();
    workflow.edges[0]!.sourcePortId = "missing-source-port";
    workflow.edges[1]!.targetPortId = "missing-target-port";

    const codes = findingCodes(workflow);
    expect(codes).toContain(WORKFLOW_VALIDATION_CODES.missingSourcePort);
    expect(codes).toContain(WORKFLOW_VALIDATION_CODES.missingTargetPort);
  });

  it("detects wrong source and target port directions", () => {
    const workflow = workflowFixture();
    workflow.nodes[0]!.ports[0]!.direction = "input";
    workflow.nodes[1]!.ports[0]!.direction = "output";

    const codes = findingCodes(workflow);
    expect(codes).toContain(WORKFLOW_VALIDATION_CODES.invalidSourcePortDirection);
    expect(codes).toContain(WORKFLOW_VALIDATION_CODES.invalidTargetPortDirection);
  });

  it("detects a self-referencing edge", () => {
    const workflow = workflowFixture();
    workflow.edges[0]!.targetNodeId = workflow.edges[0]!.sourceNodeId;
    workflow.edges[0]!.targetPortId = workflow.edges[0]!.sourcePortId;

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.selfReferencingEdge);
  });

  it("detects duplicate logical endpoints even when edge IDs differ", () => {
    const workflow = workflowFixture();
    const duplicate = structuredClone(workflow.edges[0]!);
    duplicate.id = "different-edge-id";
    workflow.edges.push(duplicate);

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.duplicateLogicalEdge);
  });

  it("rejects a runtime edge touching the simulated database", () => {
    const workflow = workflowFixture();
    workflow.edges.at(-1)!.mode = "runtime";

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.runtimeEdgeNonExecutable);
  });

  it("rejects a runtime edge touching a roadmap node", () => {
    const workflow = workflowFixture();
    const agent = workflow.nodes.find((node) => node.type === "gpt_agent")!;
    agent.implementationStatus = "roadmap";

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.runtimeEdgeNonExecutable);
  });

  it("detects incompatible edge and port data contracts", () => {
    const workflow = workflowFixture();
    workflow.edges[0]!.dataContract = "guarded_query";

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.incompatibleDataContract);
  });

  it("detects a disconnected executable document source", () => {
    const workflow = workflowFixture();
    workflow.edges = workflow.edges.filter((edge) => edge.id !== "document-source-to-retrieval");

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.disconnectedExecutableNode);
  });

  it("detects the absence of a user-input to response-output runtime path", () => {
    const workflow = workflowFixture();
    workflow.edges = workflow.edges.filter((edge) => edge.id !== "evaluator-to-response-output");

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.noRuntimePath);
  });

  it("requires at least one user input", () => {
    const workflow = workflowFixture();
    workflow.nodes = workflow.nodes.filter((node) => node.type !== "user_input");

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.missingUserInput);
  });

  it("requires at least one response output", () => {
    const workflow = workflowFixture();
    workflow.nodes = workflow.nodes.filter((node) => node.type !== "response_output");

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.missingResponseOutput);
  });

  it("detects an invalid environment-variable reference", () => {
    const workflow = workflowFixture();
    const database = workflow.nodes.find((node) => node.type === "relational_database")!;
    database.configuration.connectionReference.environmentVariableName = "invalid-name";

    expect(findingCodes(workflow)).toContain(
      WORKFLOW_VALIDATION_CODES.invalidEnvironmentVariableReference,
    );
  });

  it("detects a likely embedded secret value without storing a secret fixture", () => {
    const workflow = workflowFixture();
    const agent = workflow.nodes.find((node) => node.type === "gpt_agent")!;
    agent.configuration.systemInstruction = ["sk", "synthetic-example-value"].join("-");

    expect(parseWorkflowJson(JSON.stringify(workflow)).success).toBe(true);
    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.embeddedCredential);
  });

  it("requires explicit security metadata on every node", () => {
    const workflow = workflowFixture();
    delete (workflow.nodes[0] as unknown as Record<string, unknown>).security;

    expect(findingCodes(workflow)).toContain(WORKFLOW_VALIDATION_CODES.missingSecurityMetadata);
  });

  it("returns deterministic machine-readable findings", () => {
    const workflow = workflowFixture();
    workflow.edges[0]!.sourceNodeId = "missing-source";

    const first = validateWorkflowSemantics(workflow);
    const second = validateWorkflowSemantics(workflow);

    expect(first).toEqual(second);
    expect(first.valid).toBe(false);
    expect(first.findings[0]).toEqual(
      expect.objectContaining({
        code: expect.any(String),
        severity: "error",
        path: expect.stringMatching(/^\$/),
        message: expect.any(String),
      }),
    );
  });
});
