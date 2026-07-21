import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ARCHITECTURE_VALIDATION_CODES,
  CLASSIFICATION_RANK,
  compareClassifications,
} from "./architecture-rules";
import { validateWorkflowArchitecture } from "./architecture-validator";
import { assessWorkflowExecutionReadiness } from "./execution-readiness";
import { parseWorkflowJson } from "@/domain/workflow/workflow-parser";
import type { Workflow } from "@/domain/workflow/workflow-types";

function template(): Workflow {
  const parsed = parseWorkflowJson(
    readFileSync(resolve("templates/enterprise-rag.v1.json"), "utf8"),
  );
  if (!parsed.success) throw new Error("Invalid test template.");
  return structuredClone(parsed.data);
}

function codes(workflow: Workflow): string[] {
  return validateWorkflowArchitecture(workflow).findings.map((finding) => finding.code);
}

describe("unified architecture validation and readiness", () => {
  it("keeps the canonical local template at zero findings and ready", () => {
    const result = assessWorkflowExecutionReadiness(template());
    expect(result.ready).toBe(true);
    expect(result.report.structureValid).toBe(true);
    expect(result.report.errorCount).toBe(0);
    expect(result.report.warningCount).toBe(0);
    expect(result.report.findings).toEqual([]);
  });

  it("blocks structurally invalid unknown properties before semantic rules", () => {
    const invalid = { ...template(), unexpected: true };
    const result = assessWorkflowExecutionReadiness(invalid);
    expect(result.ready).toBe(false);
    expect(result.report.structureValid).toBe(false);
    expect(result.report.findings.every((finding) => finding.code === "STRUCTURE_INVALID")).toBe(
      true,
    );
  });

  it("blocks missing controls, unapproved tools, citations, classifications, and downgrades", () => {
    const missing = template();
    missing.nodes = missing.nodes.filter((node) => node.type !== "input_guardrail");
    missing.edges = missing.edges.filter(
      (edge) => edge.sourceNodeId !== "input-guardrail" && edge.targetNodeId !== "input-guardrail",
    );
    expect(codes(missing)).toContain(ARCHITECTURE_VALIDATION_CODES.missingRequiredControl);

    const tools = template();
    tools.nodes.find((node) => node.type === "gpt_agent")!.configuration.allowedTools = [
      "synthetic-tool",
    ];
    expect(codes(tools)).toContain(ARCHITECTURE_VALIDATION_CODES.unapprovedTool);

    const citations = template();
    citations.nodes.find((node) => node.type === "retrieval")!.configuration.citationsRequired =
      false;
    expect(codes(citations)).toContain(ARCHITECTURE_VALIDATION_CODES.citationPolicyMismatch);

    const mismatch = template();
    mismatch.nodes.find(
      (node) => node.type === "document_source",
    )!.configuration.dataClassification = "public";
    expect(codes(mismatch)).toContain(ARCHITECTURE_VALIDATION_CODES.classificationMismatch);

    const downgrade = template();
    downgrade.nodes.find((node) => node.type === "response_output")!.security.dataClassification =
      "internal";
    expect(codes(downgrade)).toContain(ARCHITECTURE_VALIDATION_CODES.classificationDowngrade);
  });

  it("keeps upload declaratively valid while blocking execution readiness", () => {
    const workflow = template();
    const source = workflow.nodes.find((node) => node.type === "document_source");
    if (!source || source.type !== "document_source") throw new Error("Document source missing.");
    source.configuration.sourceMode = "upload";
    const result = assessWorkflowExecutionReadiness(workflow);
    expect(result.ready).toBe(false);
    expect(result.report.structureValid).toBe(true);
    expect(result.report.findings).toContainEqual(
      expect.objectContaining({
        code: ARCHITECTURE_VALIDATION_CODES.uploadSourceUnsupported,
        severity: "error",
        category: "readiness",
        path: "$.nodes[2].configuration.sourceMode",
        subject: { kind: "node", id: source.id },
      }),
    );
  });

  it("keeps warning-only cost, length, and threshold findings non-blocking", () => {
    const workflow = template();
    workflow.nodes.find(
      (node) => node.type === "input_guardrail",
    )!.configuration.maximumInputLength = 100;
    const agent = workflow.nodes.find((node) => node.type === "gpt_agent")!;
    agent.configuration.reasoningEffort = "high";
    agent.configuration.maximumOutputTokens = 128_000;
    workflow.nodes.find((node) => node.type === "evaluator")!.configuration.overallPassThreshold =
      0.1;
    const report = validateWorkflowArchitecture(workflow);
    expect(report.executionReady).toBe(true);
    expect(report.errorCount).toBe(0);
    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        ARCHITECTURE_VALIDATION_CODES.guardrailLengthMismatch,
        ARCHITECTURE_VALIDATION_CODES.unboundedReasoningProfile,
        ARCHITECTURE_VALIDATION_CODES.evaluationThresholdInconsistency,
      ]),
    );
  });

  it("detects synthetic embedded credential shapes without exposing their values", () => {
    const apiKey = template();
    apiKey.nodes.find((node) => node.type === "gpt_agent")!.configuration.systemInstruction = [
      "sk",
      "synthetic-sentinel-value",
    ].join("-");
    expect(codes(apiKey)).toContain("LIKELY_EMBEDDED_SECRET");

    const connection = template();
    connection.nodes.find((node) => node.type === "gpt_agent")!.configuration.systemInstruction =
      "postgresql://synthetic-user:synthetic-pass@example.invalid/example";
    const report = validateWorkflowArchitecture(connection);
    expect(report.findings.map((finding) => finding.code)).toContain("LIKELY_EMBEDDED_SECRET");
    expect(JSON.stringify(report.findings)).not.toContain("synthetic-pass");
  });

  it("orders findings deterministically and gives every finding guidance and subject metadata", () => {
    const workflow = template();
    workflow.nodes.find((node) => node.type === "retrieval")!.configuration.citationsRequired =
      false;
    const first = validateWorkflowArchitecture(workflow);
    const second = validateWorkflowArchitecture(workflow);
    expect(first).toEqual(second);
    for (const finding of first.findings) {
      expect(finding.category).toBeTruthy();
      expect(finding.remediation).toBeTruthy();
      expect(finding.subject.kind).toMatch(/workflow|node|edge/);
    }
  });

  it("compares every ordered classification pair consistently", () => {
    const values = Object.keys(CLASSIFICATION_RANK) as Array<keyof typeof CLASSIFICATION_RANK>;
    for (const left of values) {
      for (const right of values) {
        expect(Math.sign(compareClassifications(left, right))).toBe(
          Math.sign(CLASSIFICATION_RANK[left] - CLASSIFICATION_RANK[right]),
        );
      }
    }
  });
});
