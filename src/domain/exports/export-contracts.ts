import { z } from "zod";

import { runEvidenceSchema } from "@/domain/runtime/run-evidence";
import {
  DataClassificationSchema,
  DataContractSchema,
  EdgeIdSchema,
  EdgeModeSchema,
  ImplementationStatusSchema,
  NodeIdSchema,
  NodeTypeSchema,
  PortIdSchema,
  RepositoryReferenceSchema,
  SemanticVersionSchema,
  TemplateIdSchema,
  TrustZoneSchema,
  WorkflowIdSchema,
  WorkflowSchema,
  WorkflowSchemaVersionSchema,
} from "@/domain/workflow/workflow-schema";

export const WORKFLOW_EXPORT_SCHEMA_VERSION = "1.0.0" as const;
export const ARCHITECTURE_ASSURANCE_SCHEMA_VERSION = "1.0.0" as const;
export const WORKFLOW_EXPORT_ARTIFACT_TYPE = "ai-orchestra.workflow-export" as const;
export const ARCHITECTURE_ASSURANCE_ARTIFACT_TYPE = "ai-orchestra.architecture-assurance" as const;
export const WORKFLOW_EXPORT_MIME_TYPE = "application/json;charset=utf-8" as const;
export const ARCHITECTURE_ASSURANCE_MIME_TYPE = "text/markdown;charset=utf-8" as const;

export const EXPORT_CODES = [
  "EXPORT_WORKFLOW_INVALID",
  "EXPORT_WORKFLOW_UNSAFE",
  "EXPORT_FINDING_UNSUPPORTED",
  "EXPORT_RUN_MISSING",
  "EXPORT_RUN_STALE",
  "EXPORT_EVIDENCE_INVALID",
  "EXPORT_FILENAME_UNSAFE",
  "EXPORT_DOWNLOAD_UNAVAILABLE",
  "EXPORT_SERIALIZATION_FAILED",
] as const;

export type ExportCode = (typeof EXPORT_CODES)[number];

export const EXPORT_EXPLANATIONS: Readonly<Record<ExportCode, string>> = Object.freeze({
  EXPORT_WORKFLOW_INVALID: "The workflow does not satisfy the strict Workflow 1.0.0 contract.",
  EXPORT_WORKFLOW_UNSAFE: "The workflow contains content that is unsafe to export.",
  EXPORT_FINDING_UNSUPPORTED:
    "The architecture report contains a finding that is not supported by this export version.",
  EXPORT_RUN_MISSING: "Run a governed workflow before downloading architecture assurance.",
  EXPORT_RUN_STALE:
    "The workflow differs from the submitted run snapshot. Restore that exact workflow or run again.",
  EXPORT_EVIDENCE_INVALID: "The originating RunEvidence 1.0.0 object is invalid.",
  EXPORT_FILENAME_UNSAFE: "A bounded safe artifact filename could not be generated.",
  EXPORT_DOWNLOAD_UNAVAILABLE: "This browser could not initiate the validated artifact download.",
  EXPORT_SERIALIZATION_FAILED: "The validated artifact could not be serialized safely.",
});

export const exportCodeSchema = z.enum(EXPORT_CODES);

export const exportFailureSchema = z
  .strictObject({
    success: z.literal(false),
    code: exportCodeSchema,
    explanation: z.string().min(1).max(240),
  })
  .superRefine((failure, context) => {
    if (failure.explanation !== EXPORT_EXPLANATIONS[failure.code]) {
      context.addIssue({
        code: "custom",
        path: ["explanation"],
        message: "Export explanations must come from the fixed catalog.",
      });
    }
  })
  .readonly();

export type ExportFailure = z.infer<typeof exportFailureSchema>;

export function exportFailure(code: ExportCode): ExportFailure {
  return exportFailureSchema.parse({
    success: false,
    code,
    explanation: EXPORT_EXPLANATIONS[code],
  });
}

export const sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/);

const exportPathSchema = z
  .string()
  .min(1)
  .max(400)
  .regex(/^\$(?:(?:\.[A-Za-z][A-Za-z0-9_-]*)|(?:\[\d+\]))*$/);

export const sanitizedArchitectureSubjectSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("workflow") }),
    z.strictObject({ kind: z.literal("node"), id: NodeIdSchema }),
    z.strictObject({ kind: z.literal("edge"), id: EdgeIdSchema }),
  ])
  .readonly();

export const sanitizedArchitectureFindingSchema = z
  .strictObject({
    code: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[A-Z][A-Z0-9_]*$/),
    category: z.enum([
      "structure",
      "graph",
      "configuration",
      "security",
      "governance",
      "readiness",
    ]),
    severity: z.enum(["error", "warning"]),
    path: exportPathSchema,
    explanation: z.string().min(1).max(240),
    remediation: z.string().min(1).max(240),
    subject: sanitizedArchitectureSubjectSchema,
  })
  .readonly();

export const sanitizedArchitectureReportSchema = z
  .strictObject({
    structureValid: z.boolean(),
    architectureValid: z.boolean(),
    executionReady: z.boolean(),
    errorCount: z.number().int().nonnegative().max(2_048),
    warningCount: z.number().int().nonnegative().max(2_048),
    findings: z.array(sanitizedArchitectureFindingSchema).max(4_096),
  })
  .superRefine((report, context) => {
    const errorCount = report.findings.filter((finding) => finding.severity === "error").length;
    const warningCount = report.findings.length - errorCount;
    if (report.errorCount !== errorCount) {
      context.addIssue({
        code: "custom",
        path: ["errorCount"],
        message: "The architecture error total must match the sanitized findings.",
      });
    }
    if (report.warningCount !== warningCount) {
      context.addIssue({
        code: "custom",
        path: ["warningCount"],
        message: "The architecture warning total must match the sanitized findings.",
      });
    }
    if (report.architectureValid && (!report.structureValid || errorCount > 0)) {
      context.addIssue({
        code: "custom",
        path: ["architectureValid"],
        message: "Architecture validity cannot contradict structural or error findings.",
      });
    }
    if (report.executionReady && (!report.structureValid || !report.architectureValid)) {
      context.addIssue({
        code: "custom",
        path: ["executionReady"],
        message: "Execution readiness requires a structurally valid architecture.",
      });
    }
  })
  .readonly();

export const workflowExportEnvelopeSchema = z
  .strictObject({
    artifactType: z.literal(WORKFLOW_EXPORT_ARTIFACT_TYPE),
    exportSchemaVersion: z.literal(WORKFLOW_EXPORT_SCHEMA_VERSION),
    workflowFingerprintSha256: sha256HexSchema,
    workflow: WorkflowSchema,
    architectureReport: sanitizedArchitectureReportSchema,
  })
  .readonly();

export const assuranceNodeSchema = z
  .strictObject({
    id: NodeIdSchema,
    label: z.string().min(1).max(160),
    type: NodeTypeSchema,
    implementationStatus: ImplementationStatusSchema,
    dataClassification: DataClassificationSchema,
    trustZone: TrustZoneSchema,
    documentationRef: RepositoryReferenceSchema,
  })
  .readonly();

export const assuranceEdgeSchema = z
  .strictObject({
    id: EdgeIdSchema,
    sourceNodeId: NodeIdSchema,
    sourcePortId: PortIdSchema,
    targetNodeId: NodeIdSchema,
    targetPortId: PortIdSchema,
    mode: EdgeModeSchema,
    dataContract: DataContractSchema,
    label: z.string().min(1).max(160),
  })
  .readonly();

export const assurancePolicySummarySchema = z
  .strictObject({
    defaultDataClassification: DataClassificationSchema,
    humanApprovalRequired: z.boolean(),
    maximumSteps: z.number().int().positive().max(1_000),
    maximumTotalTokens: z.number().int().positive().max(10_000_000),
    maximumEstimatedCostUsd: z.number().finite().positive().max(100_000),
    allowedToolCount: z.number().int().nonnegative().max(256),
    evaluationThresholds: z.strictObject({
      groundedness: z.number().finite().min(0).max(1),
      relevance: z.number().finite().min(0).max(1),
      citationCoverage: z.number().finite().min(0).max(1),
      overall: z.number().finite().min(0).max(1),
    }),
    deploymentProfile: z.literal("local_docker"),
    requiredEnvironmentVariableCount: z.number().int().nonnegative().max(64),
  })
  .readonly();

export const architectureAssuranceViewModelSchema = z
  .strictObject({
    artifactType: z.literal(ARCHITECTURE_ASSURANCE_ARTIFACT_TYPE),
    assuranceSchemaVersion: z.literal(ARCHITECTURE_ASSURANCE_SCHEMA_VERSION),
    workflowExportSchemaVersion: z.literal(WORKFLOW_EXPORT_SCHEMA_VERSION),
    workflow: z
      .strictObject({
        schemaVersion: WorkflowSchemaVersionSchema,
        workflowId: WorkflowIdSchema,
        name: z.string().min(1).max(160),
        templateId: TemplateIdSchema,
        templateVersion: SemanticVersionSchema,
        fingerprintSha256: sha256HexSchema,
      })
      .readonly(),
    architectureReport: sanitizedArchitectureReportSchema,
    nodes: z.array(assuranceNodeSchema).min(1).max(256),
    edges: z.array(assuranceEdgeSchema).max(1_024),
    policies: assurancePolicySummarySchema,
    runEvidence: runEvidenceSchema,
  })
  .readonly();

export type WorkflowExportEnvelope = z.infer<typeof workflowExportEnvelopeSchema>;
export type SanitizedArchitectureReport = z.infer<typeof sanitizedArchitectureReportSchema>;
export type ArchitectureAssuranceViewModel = z.infer<typeof architectureAssuranceViewModelSchema>;

export const safeArtifactFilenameSchema = z
  .string()
  .min(1)
  .max(180)
  .regex(
    /^ai-orchestra-[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*\.(?:workflow-export|architecture-assurance)\.v1\.0\.0\.(?:json|md)$/,
  );

const workflowArtifactSchema = z.strictObject({
  artifactType: z.literal(WORKFLOW_EXPORT_ARTIFACT_TYPE),
  schemaVersion: z.literal(WORKFLOW_EXPORT_SCHEMA_VERSION),
  filename: safeArtifactFilenameSchema.regex(/\.workflow-export\.v1\.0\.0\.json$/),
  mimeType: z.literal(WORKFLOW_EXPORT_MIME_TYPE),
  text: z.string().min(1).max(8_000_000),
  byteLength: z.number().int().positive().max(16_000_000),
});

const assuranceArtifactSchema = z.strictObject({
  artifactType: z.literal(ARCHITECTURE_ASSURANCE_ARTIFACT_TYPE),
  schemaVersion: z.literal(ARCHITECTURE_ASSURANCE_SCHEMA_VERSION),
  filename: safeArtifactFilenameSchema.regex(/\.architecture-assurance\.v1\.0\.0\.md$/),
  mimeType: z.literal(ARCHITECTURE_ASSURANCE_MIME_TYPE),
  text: z.string().min(1).max(8_000_000),
  byteLength: z.number().int().positive().max(16_000_000),
});

export const downloadableTextArtifactSchema = z
  .discriminatedUnion("artifactType", [workflowArtifactSchema, assuranceArtifactSchema])
  .superRefine((artifact, context) => {
    if (new TextEncoder().encode(artifact.text).byteLength !== artifact.byteLength) {
      context.addIssue({
        code: "custom",
        path: ["byteLength"],
        message: "Artifact byte length must match its UTF-8 text.",
      });
    }
  })
  .readonly();

export type DownloadableTextArtifact = z.infer<typeof downloadableTextArtifactSchema>;
export type ExportResult =
  Readonly<{ success: true; artifact: DownloadableTextArtifact }> | ExportFailure;

export function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value !== null && typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return Object.fromEntries(
      Object.keys(record)
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
        .map((key) => [key, sortObjectKeys(record[key])]),
    );
  }
  return value;
}

export function serializeDeterministicJson(value: unknown): string {
  const serialized = JSON.stringify(sortObjectKeys(value), null, 2);
  if (serialized === undefined) throw new Error("JSON serialization did not produce text.");
  return `${serialized}\n`;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
