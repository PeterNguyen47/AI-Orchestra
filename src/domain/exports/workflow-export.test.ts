import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCanonicalWorkflowArchitecture } from "@/domain/validation/architecture-validator";
import { parseWorkflow } from "@/domain/workflow/workflow-parser";
import {
  downloadableTextArtifactSchema,
  exportFailureSchema,
  sanitizedArchitectureReportSchema,
  serializeDeterministicJson,
} from "./export-contracts";
import { generateWorkflowExport } from "./workflow-export";

function canonicalWorkflow() {
  const parsed = parseWorkflow(
    JSON.parse(readFileSync("templates/enterprise-rag.v1.json", "utf8")),
  );
  if (!parsed.success) throw new Error("Canonical workflow fixture is invalid.");
  return structuredClone(parsed.data);
}

describe("workflow export", () => {
  it("matches the checked-in canonical JSON golden byte for byte", async () => {
    const workflow = canonicalWorkflow();
    const result = await generateWorkflowExport(
      workflow,
      validateCanonicalWorkflowArchitecture(workflow),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.artifact.text).toBe(
      readFileSync("tests/fixtures/exports/enterprise-rag.workflow-export.v1.0.0.json", "utf8"),
    );
  });

  it("produces identical bytes and workflow fingerprints across repeated generation", async () => {
    const workflow = canonicalWorkflow();
    const report = validateCanonicalWorkflowArchitecture(workflow);
    const first = await generateWorkflowExport(workflow, report);
    const second = await generateWorkflowExport(workflow, report);
    expect(first).toEqual(second);
    if (!first.success || !second.success) return;
    expect(JSON.parse(first.artifact.text).workflowFingerprintSha256).toBe(
      JSON.parse(second.artifact.text).workflowFingerprintSha256,
    );
  });

  it("round-trips the enclosed workflow through the strict parser without semantic drift", async () => {
    const workflow = canonicalWorkflow();
    const result = await generateWorkflowExport(
      workflow,
      validateCanonicalWorkflowArchitecture(workflow),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const enclosed = JSON.parse(result.artifact.text).workflow;
    const reparsed = parseWorkflow(enclosed);
    expect(reparsed).toEqual({ success: true, data: workflow });
  });

  it("preserves node, edge, port, tag, and allowed-tool array order", async () => {
    const workflow = canonicalWorkflow();
    const result = await generateWorkflowExport(
      workflow,
      validateCanonicalWorkflowArchitecture(workflow),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const enclosed = JSON.parse(result.artifact.text).workflow;
    expect(enclosed.nodes.map((node: { id: string }) => node.id)).toEqual(
      workflow.nodes.map((node) => node.id),
    );
    expect(enclosed.edges.map((edge: { id: string }) => edge.id)).toEqual(
      workflow.edges.map((edge) => edge.id),
    );
    expect(enclosed.nodes[3].ports.map((port: { id: string }) => port.id)).toEqual(
      workflow.nodes[3]?.ports.map((port) => port.id),
    );
    expect(enclosed.metadata.tags).toEqual(workflow.metadata.tags);
    expect(enclosed.policies.toolPolicy.allowedTools).toEqual(
      workflow.policies.toolPolicy.allowedTools,
    );
  });

  it("exports a structurally valid execution-not-ready workflow with deterministic findings", async () => {
    const workflow = canonicalWorkflow();
    const retrieval = workflow.nodes.find((node) => node.type === "retrieval");
    if (!retrieval || retrieval.type !== "retrieval") throw new Error("Retrieval node missing.");
    retrieval.configuration.citationsRequired = false;
    const report = validateCanonicalWorkflowArchitecture(workflow);
    expect(report.executionReady).toBe(false);
    const result = await generateWorkflowExport(workflow, report);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const envelope = JSON.parse(result.artifact.text);
    expect(envelope.architectureReport.executionReady).toBe(false);
    expect(envelope.architectureReport.findings[0]).toMatchObject({
      code: "CITATION_POLICY_MISMATCH",
      severity: "error",
    });
    expect(envelope.architectureReport.findings[0].explanation).not.toBe(
      report.findings[0]?.message,
    );

    const authoritativeSubjects = {
      structureValid: true,
      architectureValid: false,
      executionReady: false,
      errorCount: 3,
      warningCount: 0,
      findings: [
        {
          code: "MISSING_USER_INPUT",
          category: "graph",
          severity: "error",
          path: "$.nodes",
          message: "Synthetic workflow finding.",
          remediation: "Synthetic workflow remediation.",
          subject: { kind: "workflow" },
        },
        {
          code: "CITATION_POLICY_MISMATCH",
          category: "security",
          severity: "error",
          path: "$.nodes[0]",
          message: "Synthetic node finding.",
          remediation: "Synthetic node remediation.",
          subject: { kind: "node", id: workflow.nodes[0]!.id },
        },
        {
          code: "RUNTIME_EDGE_NON_EXECUTABLE",
          category: "readiness",
          severity: "error",
          path: "$.edges[0]",
          message: "Synthetic edge finding.",
          remediation: "Synthetic edge remediation.",
          subject: { kind: "edge", id: workflow.edges[0]!.id },
        },
      ],
    };
    const subjects = await generateWorkflowExport(workflow, authoritativeSubjects);
    expect(subjects.success).toBe(true);
    if (!subjects.success) return;
    expect(
      JSON.parse(subjects.artifact.text).architectureReport.findings.map(
        (finding: { subject: { kind: string } }) => finding.subject.kind,
      ),
    ).toEqual(["workflow", "edge", "node"]);

    const sourceFinding = report.findings[0]!;
    const unsupported = await generateWorkflowExport(workflow, {
      ...report,
      findings: [{ ...sourceFinding, code: "SYNTHETIC_UNSUPPORTED_FINDING" }],
    });
    expect(unsupported).toMatchObject({ success: false, code: "EXPORT_FINDING_UNSUPPORTED" });
    expect(unsupported).not.toHaveProperty("artifact");

    const missingNode = await generateWorkflowExport(workflow, {
      ...report,
      findings: [{ ...sourceFinding, subject: { kind: "node", id: "missing-node" } }],
    });
    expect(missingNode).toMatchObject({ success: false, code: "EXPORT_WORKFLOW_INVALID" });
    expect(missingNode).not.toHaveProperty("artifact");

    const missingEdge = await generateWorkflowExport(workflow, {
      ...report,
      findings: [
        {
          ...sourceFinding,
          code: "RUNTIME_EDGE_NON_EXECUTABLE",
          subject: { kind: "edge", id: "missing-edge" },
        },
      ],
    });
    expect(missingEdge).toMatchObject({ success: false, code: "EXPORT_WORKFLOW_INVALID" });
    expect(missingEdge).not.toHaveProperty("artifact");
  });

  it("exports the fixed upload-readiness projection without raw validator text", async () => {
    const workflow = canonicalWorkflow();
    const source = workflow.nodes.find((node) => node.type === "document_source");
    if (!source || source.type !== "document_source") throw new Error("Document source missing.");
    source.configuration.sourceMode = "upload";
    const report = validateCanonicalWorkflowArchitecture(workflow);
    const result = await generateWorkflowExport(workflow, report);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const finding = JSON.parse(result.artifact.text).architectureReport.findings.find(
      (item: { code: string }) => item.code === "UPLOAD_SOURCE_UNSUPPORTED",
    );
    expect(finding).toMatchObject({
      code: "UPLOAD_SOURCE_UNSUPPORTED",
      severity: "error",
      subject: { kind: "node", id: source.id },
      explanation: "Document upload is unavailable on the MVP judge path.",
    });
    expect(finding.explanation).not.toBe(
      report.findings.find((item) => item.code === "UPLOAD_SOURCE_UNSUPPORTED")?.message,
    );
  });

  it("rejects structurally invalid input without producing partial bytes", async () => {
    const result = await generateWorkflowExport({}, { structureValid: false });
    expect(result).toMatchObject({ success: false, code: "EXPORT_WORKFLOW_INVALID" });
    expect(result).not.toHaveProperty("artifact");

    expect(
      exportFailureSchema.safeParse({
        success: false,
        code: "EXPORT_WORKFLOW_INVALID",
        explanation: "Synthetic mismatched explanation.",
      }).success,
    ).toBe(false);

    const validEmptyReport = {
      structureValid: true,
      architectureValid: true,
      executionReady: true,
      errorCount: 0,
      warningCount: 0,
      findings: [],
    };
    for (const contradiction of [
      { ...validEmptyReport, errorCount: 1 },
      { ...validEmptyReport, warningCount: 1 },
      { ...validEmptyReport, structureValid: false },
      { ...validEmptyReport, architectureValid: false },
    ]) {
      expect(sanitizedArchitectureReportSchema.safeParse(contradiction).success).toBe(false);
    }

    expect(
      downloadableTextArtifactSchema.safeParse({
        artifactType: "ai-orchestra.workflow-export",
        schemaVersion: "1.0.0",
        filename: "ai-orchestra-safe.workflow-export.v1.0.0.json",
        mimeType: "application/json;charset=utf-8",
        text: "{}",
        byteLength: 1,
      }).success,
    ).toBe(false);
    expect(() => serializeDeterministicJson(undefined)).toThrow(
      "JSON serialization did not produce text.",
    );
  });

  it("rejects unsafe workflow content before artifact creation", async () => {
    const workflow = canonicalWorkflow();
    workflow.description = "authorization=synthetic-value";
    const result = await generateWorkflowExport(
      workflow,
      validateCanonicalWorkflowArchitecture(workflow),
    );
    expect(result).toMatchObject({ success: false, code: "EXPORT_WORKFLOW_UNSAFE" });
    expect(result).not.toHaveProperty("artifact");
  });
});
