import { z } from "zod";

import type { ArchitectureRuleCode } from "@/domain/validation/architecture-rules";
import { parseWorkflow, parseWorkflowJson } from "@/domain/workflow/workflow-parser";
import type { Workflow } from "@/domain/workflow/workflow-types";
import type { WorkflowValidationCode } from "@/domain/workflow/workflow-validator";
import {
  downloadableTextArtifactSchema,
  exportFailure,
  sanitizedArchitectureReportSchema,
  serializeDeterministicJson,
  sha256Hex,
  workflowExportEnvelopeSchema,
  WORKFLOW_EXPORT_ARTIFACT_TYPE,
  WORKFLOW_EXPORT_MIME_TYPE,
  WORKFLOW_EXPORT_SCHEMA_VERSION,
  type ExportFailure,
  type ExportResult,
  type SanitizedArchitectureReport,
} from "./export-contracts";
import { createArtifactFilename, inspectWorkflowExportSafety } from "./export-safety";

export type ExportFindingCode = "STRUCTURE_INVALID" | WorkflowValidationCode | ArchitectureRuleCode;
type FindingCatalogEntry = Readonly<{ explanation: string; remediation: string }>;
const entry = (explanation: string, remediation: string): FindingCatalogEntry => ({
  explanation,
  remediation,
});

export const ARCHITECTURE_FINDING_EXPORT_CATALOG = Object.freeze({
  STRUCTURE_INVALID: entry(
    "A field violates Workflow 1.0.0.",
    "Correct the field to match Workflow 1.0.0.",
  ),
  DUPLICATE_NODE_ID: entry(
    "Nodes share a stable identifier.",
    "Assign every node a unique stable identifier.",
  ),
  DUPLICATE_EDGE_ID: entry(
    "Edges share a stable identifier.",
    "Assign every edge a unique stable identifier.",
  ),
  DUPLICATE_PORT_ID: entry(
    "A node has duplicate port identifiers.",
    "Assign unique port identifiers within the node.",
  ),
  MISSING_SOURCE_NODE: entry(
    "An edge source node does not exist.",
    "Reconnect the edge to an existing source node.",
  ),
  MISSING_TARGET_NODE: entry(
    "An edge target node does not exist.",
    "Reconnect the edge to an existing target node.",
  ),
  MISSING_SOURCE_PORT: entry(
    "An edge source port does not exist.",
    "Select an existing output port on the source node.",
  ),
  MISSING_TARGET_PORT: entry(
    "An edge target port does not exist.",
    "Select an existing input port on the target node.",
  ),
  INVALID_SOURCE_PORT_DIRECTION: entry(
    "An edge source is not an output port.",
    "Use an output port as the edge source.",
  ),
  INVALID_TARGET_PORT_DIRECTION: entry(
    "An edge target is not an input port.",
    "Use an input port as the edge target.",
  ),
  SELF_REFERENCING_EDGE: entry("An edge connects a node to itself.", "Connect two distinct nodes."),
  DUPLICATE_LOGICAL_EDGE: entry(
    "The workflow repeats a logical connection.",
    "Remove the duplicate connection.",
  ),
  RUNTIME_EDGE_NON_EXECUTABLE: entry(
    "A runtime edge touches a non-executable node.",
    "Use an advisory edge or executable nodes only.",
  ),
  INCOMPATIBLE_DATA_CONTRACT: entry(
    "Connected ports declare incompatible data contracts.",
    "Connect ports with the same data contract.",
  ),
  MISSING_USER_INPUT: entry(
    "The workflow lacks an executable user-input start.",
    "Add and connect an executable user-input node.",
  ),
  MISSING_RESPONSE_OUTPUT: entry(
    "The workflow lacks an executable response-output end.",
    "Add and connect an executable response-output node.",
  ),
  NO_RUNTIME_PATH: entry(
    "No runtime path connects input to output.",
    "Create a valid runtime path from input to output.",
  ),
  DISCONNECTED_EXECUTABLE_NODE: entry(
    "An executable node is disconnected from the runtime path.",
    "Connect it to a complete executable path.",
  ),
  MISSING_SECURITY_METADATA: entry(
    "A node lacks required security metadata.",
    "Declare a supported classification and trust zone.",
  ),
  INVALID_SECURITY_METADATA: entry(
    "A node has unsupported security metadata.",
    "Choose supported classification and trust-zone values.",
  ),
  INVALID_ENVIRONMENT_VARIABLE_REFERENCE: entry(
    "A secret reference is not an environment-variable name.",
    "Use an uppercase name without a secret value.",
  ),
  LIKELY_EMBEDDED_SECRET: entry(
    "A workflow field appears to contain a secret value.",
    "Remove the value and use an environment reference.",
  ),
  MISSING_REQUIRED_CONTROL: entry(
    "The runtime path omits a governed control.",
    "Add and correctly connect the required control.",
  ),
  UNAPPROVED_TOOL: entry(
    "A model node declares an unapproved tool.",
    "Remove tool identifiers from the MVP workflow.",
  ),
  CITATION_POLICY_MISMATCH: entry(
    "Citation requirements are inconsistent.",
    "Enable citations at every required boundary.",
  ),
  CLASSIFICATION_MISMATCH: entry(
    "Configuration and node classifications differ.",
    "Align both classification declarations.",
  ),
  CLASSIFICATION_DOWNGRADE: entry(
    "Runtime data flows to a lower classification.",
    "Raise the target classification or redesign the flow.",
  ),
  GUARDRAIL_LENGTH_MISMATCH: entry(
    "The guardrail accepts less input than its source.",
    "Align the limits or document the restriction.",
  ),
  EXTERNAL_CONFIDENTIAL_DATA: entry(
    "Confidential data enters an external-service zone.",
    "Review handling and redaction before production use.",
  ),
  UNBOUNDED_REASONING_PROFILE: entry(
    "Reasoning and output limits may increase cost.",
    "Reduce reasoning effort or output tokens.",
  ),
  EVALUATION_THRESHOLD_INCONSISTENCY: entry(
    "The overall threshold is outside the metric range.",
    "Reconcile overall and metric thresholds.",
  ),
  // AO009_WORKFLOW_EXPORT_CATALOG_NEXT
} satisfies Readonly<Record<ExportFindingCode, FindingCatalogEntry>>);

const rawSubjectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("workflow"), id: z.string().optional() }),
  z.strictObject({ kind: z.literal("node"), id: z.string().min(1).max(100) }),
  z.strictObject({ kind: z.literal("edge"), id: z.string().min(1).max(100) }),
]);

const rawArchitectureReportSchema = z.strictObject({
  structureValid: z.boolean(),
  architectureValid: z.boolean(),
  executionReady: z.boolean(),
  errorCount: z.number().int().nonnegative().max(2_048),
  warningCount: z.number().int().nonnegative().max(2_048),
  findings: z
    .array(
      z.strictObject({
        code: z.string().min(1).max(80),
        category: z.enum([
          "structure",
          "graph",
          "configuration",
          "security",
          "governance",
          "readiness",
        ]),
        severity: z.enum(["error", "warning"]),
        path: z.string().min(1).max(400),
        message: z.string().min(1).max(4_000),
        remediation: z.string().min(1).max(4_000),
        subject: rawSubjectSchema,
      }),
    )
    .max(4_096),
});

const lexicalCompare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

export type CanonicalWorkflowSnapshotResult =
  Readonly<{ success: true; workflow: Workflow; canonicalBytes: string }> | ExportFailure;

export function createCanonicalWorkflowSnapshot(input: unknown): CanonicalWorkflowSnapshotResult {
  const parsed = parseWorkflow(input);
  if (!parsed.success) return exportFailure("EXPORT_WORKFLOW_INVALID");
  try {
    return {
      success: true,
      workflow: parsed.data,
      canonicalBytes: serializeDeterministicJson(parsed.data),
    };
  } catch {
    return exportFailure("EXPORT_SERIALIZATION_FAILED");
  }
}

export async function generateWorkflowExport(
  workflowInput: unknown,
  architectureReportInput: unknown,
): Promise<ExportResult> {
  const snapshot = createCanonicalWorkflowSnapshot(workflowInput);
  if (!snapshot.success) return snapshot;
  const safety = inspectWorkflowExportSafety(snapshot.workflow);
  if (!safety.success) return safety;
  const report = projectArchitectureReport(architectureReportInput, snapshot.workflow);
  if (!report.success) return report;
  const filename = createArtifactFilename(
    snapshot.workflow.workflowId,
    WORKFLOW_EXPORT_ARTIFACT_TYPE,
  );
  if (!filename.success) return filename;

  try {
    const envelope = workflowExportEnvelopeSchema.parse({
      artifactType: WORKFLOW_EXPORT_ARTIFACT_TYPE,
      exportSchemaVersion: WORKFLOW_EXPORT_SCHEMA_VERSION,
      workflowFingerprintSha256: await sha256Hex(snapshot.canonicalBytes),
      workflow: snapshot.workflow,
      architectureReport: report.report,
    });
    const enclosedWorkflow = createCanonicalWorkflowSnapshot(envelope.workflow);
    if (!enclosedWorkflow.success || enclosedWorkflow.canonicalBytes !== snapshot.canonicalBytes) {
      return exportFailure("EXPORT_SERIALIZATION_FAILED");
    }
    const text = serializeDeterministicJson(envelope);
    const reparsedEnvelope = workflowExportEnvelopeSchema.safeParse(JSON.parse(text));
    const reparsedWorkflow = reparsedEnvelope.success
      ? parseWorkflowJson(serializeDeterministicJson(reparsedEnvelope.data.workflow))
      : undefined;
    if (!reparsedEnvelope.success || !reparsedWorkflow?.success) {
      return exportFailure("EXPORT_SERIALIZATION_FAILED");
    }
    const artifact = downloadableTextArtifactSchema.safeParse({
      artifactType: WORKFLOW_EXPORT_ARTIFACT_TYPE,
      schemaVersion: WORKFLOW_EXPORT_SCHEMA_VERSION,
      filename: filename.filename,
      mimeType: WORKFLOW_EXPORT_MIME_TYPE,
      text,
      byteLength: new TextEncoder().encode(text).byteLength,
    });
    return artifact.success
      ? { success: true, artifact: artifact.data }
      : exportFailure("EXPORT_SERIALIZATION_FAILED");
  } catch {
    return exportFailure("EXPORT_SERIALIZATION_FAILED");
  }
}

export type ArchitectureReportProjectionResult =
  Readonly<{ success: true; report: SanitizedArchitectureReport }> | ExportFailure;

export function projectArchitectureReport(
  input: unknown,
  workflow: Workflow,
): ArchitectureReportProjectionResult {
  const parsed = rawArchitectureReportSchema.safeParse(input);
  if (!parsed.success || !parsed.data.structureValid)
    return exportFailure("EXPORT_WORKFLOW_INVALID");
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  const edgeIds = new Set(workflow.edges.map((edge) => edge.id));
  const projected = [];
  for (const finding of parsed.data.findings) {
    if (!(finding.code in ARCHITECTURE_FINDING_EXPORT_CATALOG)) {
      return exportFailure("EXPORT_FINDING_UNSUPPORTED");
    }
    if (
      (finding.subject.kind === "node" && !nodeIds.has(finding.subject.id)) ||
      (finding.subject.kind === "edge" && !edgeIds.has(finding.subject.id))
    )
      return exportFailure("EXPORT_WORKFLOW_INVALID");
    const catalog = ARCHITECTURE_FINDING_EXPORT_CATALOG[finding.code as ExportFindingCode];
    projected.push({
      code: finding.code,
      category: finding.category,
      severity: finding.severity,
      path: finding.path,
      explanation: catalog.explanation,
      remediation: catalog.remediation,
      subject:
        finding.subject.kind === "workflow"
          ? ({ kind: "workflow" } as const)
          : { kind: finding.subject.kind, id: finding.subject.id },
    });
  }
  projected.sort(
    (left, right) =>
      lexicalCompare(left.severity, right.severity) ||
      lexicalCompare(left.category, right.category) ||
      lexicalCompare(left.path, right.path) ||
      lexicalCompare(left.code, right.code) ||
      lexicalCompare(left.subject.kind, right.subject.kind) ||
      lexicalCompare(
        "id" in left.subject ? left.subject.id : "",
        "id" in right.subject ? right.subject.id : "",
      ),
  );
  const report = sanitizedArchitectureReportSchema.safeParse({
    structureValid: parsed.data.structureValid,
    architectureValid: parsed.data.architectureValid,
    executionReady: parsed.data.executionReady,
    errorCount: parsed.data.errorCount,
    warningCount: parsed.data.warningCount,
    findings: projected,
  });
  return report.success
    ? { success: true, report: report.data }
    : exportFailure("EXPORT_WORKFLOW_INVALID");
}
