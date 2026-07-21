import { runEvidenceSchema, type RunEvidence } from "@/domain/runtime/run-evidence";
import type { Workflow } from "@/domain/workflow/workflow-types";
import {
  ARCHITECTURE_ASSURANCE_ARTIFACT_TYPE,
  ARCHITECTURE_ASSURANCE_MIME_TYPE,
  ARCHITECTURE_ASSURANCE_SCHEMA_VERSION,
  architectureAssuranceViewModelSchema,
  downloadableTextArtifactSchema,
  exportFailure,
  sha256Hex,
  WORKFLOW_EXPORT_SCHEMA_VERSION,
  type ArchitectureAssuranceViewModel,
  type ExportFailure,
  type ExportResult,
} from "./export-contracts";
import {
  createArtifactFilename,
  escapeMarkdownText,
  inspectWorkflowExportSafety,
} from "./export-safety";
import { createCanonicalWorkflowSnapshot, projectArchitectureReport } from "./workflow-export";

export type AssuranceRunBinding = Readonly<{
  evidence: RunEvidence;
  submittedWorkflow: Workflow;
  submittedCanonicalWorkflowBytes: string;
}>;

type PreparedAssurance = Readonly<{
  currentWorkflow: Workflow;
  submittedWorkflow: Workflow;
  submittedCanonicalWorkflowBytes: string;
  evidence: RunEvidence;
}>;
type PreparedAssuranceResult = Readonly<{ success: true; data: PreparedAssurance }> | ExportFailure;

function prepareAssurance(
  currentWorkflowInput: unknown,
  binding: AssuranceRunBinding | undefined,
): PreparedAssuranceResult {
  if (!binding) return exportFailure("EXPORT_RUN_MISSING");
  const current = createCanonicalWorkflowSnapshot(currentWorkflowInput);
  const submitted = createCanonicalWorkflowSnapshot(binding.submittedWorkflow);
  if (!current.success || !submitted.success) return exportFailure("EXPORT_WORKFLOW_INVALID");
  if (submitted.canonicalBytes !== binding.submittedCanonicalWorkflowBytes) {
    return exportFailure("EXPORT_EVIDENCE_INVALID");
  }
  const currentSafety = inspectWorkflowExportSafety(current.workflow);
  const submittedSafety = inspectWorkflowExportSafety(submitted.workflow);
  if (!currentSafety.success || !submittedSafety.success)
    return exportFailure("EXPORT_WORKFLOW_UNSAFE");
  if (current.canonicalBytes !== binding.submittedCanonicalWorkflowBytes) {
    return exportFailure("EXPORT_RUN_STALE");
  }
  const evidence = runEvidenceSchema.safeParse(binding.evidence);
  if (!evidence.success) return exportFailure("EXPORT_EVIDENCE_INVALID");
  return {
    success: true,
    data: {
      currentWorkflow: current.workflow,
      submittedWorkflow: submitted.workflow,
      submittedCanonicalWorkflowBytes: binding.submittedCanonicalWorkflowBytes,
      evidence: evidence.data,
    },
  };
}

export function getAssuranceAvailability(
  currentWorkflowInput: unknown,
  binding: AssuranceRunBinding | undefined,
): Readonly<{ success: true }> | ExportFailure {
  const prepared = prepareAssurance(currentWorkflowInput, binding);
  return prepared.success ? { success: true } : prepared;
}

async function buildAssuranceViewModel(
  prepared: PreparedAssurance,
  architectureReportInput: unknown,
): Promise<Readonly<{ success: true; model: ArchitectureAssuranceViewModel }> | ExportFailure> {
  const report = projectArchitectureReport(architectureReportInput, prepared.currentWorkflow);
  if (!report.success) return report;
  const workflow = prepared.submittedWorkflow;
  const parsed = architectureAssuranceViewModelSchema.safeParse({
    artifactType: ARCHITECTURE_ASSURANCE_ARTIFACT_TYPE,
    assuranceSchemaVersion: ARCHITECTURE_ASSURANCE_SCHEMA_VERSION,
    workflowExportSchemaVersion: WORKFLOW_EXPORT_SCHEMA_VERSION,
    workflow: {
      schemaVersion: workflow.schemaVersion,
      workflowId: workflow.workflowId,
      name: workflow.name,
      templateId: workflow.template.id,
      templateVersion: workflow.template.version,
      fingerprintSha256: await sha256Hex(prepared.submittedCanonicalWorkflowBytes),
    },
    architectureReport: report.report,
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      implementationStatus: node.implementationStatus,
      dataClassification: node.security.dataClassification,
      trustZone: node.security.trustZone,
      documentationRef: node.documentationRef,
    })),
    edges: workflow.edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      sourcePortId: edge.sourcePortId,
      targetNodeId: edge.targetNodeId,
      targetPortId: edge.targetPortId,
      mode: edge.mode,
      dataContract: edge.dataContract,
      label: edge.label,
    })),
    policies: {
      defaultDataClassification: workflow.policies.dataPolicy.defaultClassification,
      humanApprovalRequired: workflow.policies.humanApprovalPolicy.required,
      maximumSteps: workflow.policies.executionLimits.maximumSteps,
      maximumTotalTokens: workflow.policies.executionLimits.maximumTotalTokens,
      maximumEstimatedCostUsd: workflow.policies.executionLimits.maximumEstimatedCostUsd,
      allowedToolCount: workflow.policies.toolPolicy.allowedTools.length,
      evaluationThresholds: {
        groundedness: workflow.evaluation.metricThresholds.groundedness,
        relevance: workflow.evaluation.metricThresholds.relevance,
        citationCoverage: workflow.evaluation.metricThresholds.citation_coverage,
        overall: workflow.evaluation.overallPassThreshold,
      },
      deploymentProfile: workflow.deployment.profile,
      requiredEnvironmentVariableCount: workflow.deployment.requiredEnvironmentVariables.length,
    },
    runEvidence: prepared.evidence,
  });
  return parsed.success
    ? { success: true, model: parsed.data }
    : exportFailure("EXPORT_SERIALIZATION_FAILED");
}

const yesNo = (value: boolean) => (value ? "Yes" : "No");
const md = (value: string | number | boolean) => escapeMarkdownText(String(value));

export function renderArchitectureAssuranceMarkdown(input: unknown): string {
  const model = architectureAssuranceViewModelSchema.parse(input);
  const lines: string[] = ["# AI Orchestra architecture assurance", ""];
  const section = (title: string) => lines.push(`## ${title}`, "");
  const fact = (label: string, value: string | number | boolean) =>
    lines.push(`- ${label}: ${md(value)}`);

  section("Artifact identity");
  fact("Artifact type", model.artifactType);
  fact("Assurance schema version", model.assuranceSchemaVersion);
  fact("Workflow export schema version", model.workflowExportSchemaVersion);
  fact("RunEvidence schema version", model.runEvidence.schemaVersion);
  lines.push("");

  section("Workflow identity and provenance");
  fact("Workflow schema version", model.workflow.schemaVersion);
  fact("Workflow ID", model.workflow.workflowId);
  fact("Workflow name", model.workflow.name);
  fact("Template ID", model.workflow.templateId);
  fact("Template version", model.workflow.templateVersion);
  fact("Workflow fingerprint SHA-256", model.workflow.fingerprintSha256);
  fact("Originating run ID", model.runEvidence.runId);
  lines.push("");

  section("Architecture status");
  fact("Structure valid", yesNo(model.architectureReport.structureValid));
  fact("Architecture valid", yesNo(model.architectureReport.architectureValid));
  fact("Execution ready", yesNo(model.architectureReport.executionReady));
  fact("Error count", model.architectureReport.errorCount);
  fact("Warning count", model.architectureReport.warningCount);
  lines.push("");

  section("Node inventory");
  for (const [index, node] of model.nodes.entries()) {
    lines.push(`### Node ${index + 1}: ${md(node.label)}`, "");
    fact("Node ID", node.id);
    fact("Node type", node.type);
    fact("Implementation status", node.implementationStatus);
    fact("Data classification", node.dataClassification);
    fact("Trust zone", node.trustZone);
    fact("Documentation reference", node.documentationRef);
    lines.push("");
  }

  section("Edge inventory");
  for (const [index, edge] of model.edges.entries()) {
    lines.push(`### Edge ${index + 1}: ${md(edge.label)}`, "");
    fact("Edge ID", edge.id);
    fact("Source", `${edge.sourceNodeId}.${edge.sourcePortId}`);
    fact("Target", `${edge.targetNodeId}.${edge.targetPortId}`);
    fact("Mode", edge.mode);
    fact("Data contract", edge.dataContract);
    lines.push("");
  }

  section("Validation and readiness findings");
  if (model.architectureReport.findings.length === 0) lines.push("- No findings.", "");
  for (const [index, finding] of model.architectureReport.findings.entries()) {
    lines.push(`### Finding ${index + 1}`, "");
    fact("Code", finding.code);
    fact("Severity", finding.severity);
    fact("Category", finding.category);
    fact("Path", finding.path);
    fact("Subject kind", finding.subject.kind);
    if ("id" in finding.subject) fact("Subject ID", finding.subject.id);
    fact("Explanation", finding.explanation);
    fact("Remediation", finding.remediation);
    lines.push("");
  }

  section("Policies and security boundaries");
  fact("Default data classification", model.policies.defaultDataClassification);
  fact("Human approval required", yesNo(model.policies.humanApprovalRequired));
  fact("Maximum steps", model.policies.maximumSteps);
  fact("Maximum total tokens", model.policies.maximumTotalTokens);
  fact("Maximum estimated cost USD", model.policies.maximumEstimatedCostUsd);
  fact("Allowed-tool count", model.policies.allowedToolCount);
  fact("Groundedness threshold", model.policies.evaluationThresholds.groundedness);
  fact("Relevance threshold", model.policies.evaluationThresholds.relevance);
  fact("Citation-coverage threshold", model.policies.evaluationThresholds.citationCoverage);
  fact("Overall evaluation threshold", model.policies.evaluationThresholds.overall);
  fact("Deployment profile", model.policies.deploymentProfile);
  fact("Required environment-variable count", model.policies.requiredEnvironmentVariableCount);
  lines.push("");

  section("Originating governed run");
  fact("Run ID", model.runEvidence.runId);
  fact("Status", model.runEvidence.status);
  fact("Code", model.runEvidence.code);
  fact("Fixed explanation", model.runEvidence.explanation);
  if (model.runEvidence.modelEvidence) {
    fact("Target provider", model.runEvidence.modelEvidence.target.provider);
    fact("Target model", model.runEvidence.modelEvidence.target.model);
    fact("Target deployment mode", model.runEvidence.modelEvidence.target.deploymentMode);
    fact("Model invocation reached", yesNo(model.runEvidence.modelEvidence.invocationReached));
    const observed = model.runEvidence.modelEvidence.observed;
    if (observed?.model) fact("Observed model", observed.model);
    if (observed?.modelDigest) fact("Observed model digest", observed.modelDigest);
    if (observed?.runtime) fact("Observed runtime", observed.runtime);
    if (observed?.runtimeVersion) fact("Observed runtime version", observed.runtimeVersion);
  }
  lines.push("");

  section("Ordered execution timeline");
  for (const stage of model.runEvidence.timeline) {
    lines.push(
      `${stage.sequence}. ${md(stage.nodeId)} - ${md(stage.nodeType)} - ${md(stage.outcome)}`,
    );
  }
  lines.push("");

  section("Guardrail and retrieval evidence");
  const inputDecision = model.runEvidence.inputGuardrailDecision;
  if (inputDecision) {
    fact("Input guardrail status", inputDecision.status);
    fact("Input guardrail code", inputDecision.code);
    fact("Input guardrail explanation", inputDecision.explanation);
    fact("Input character count", inputDecision.inputCharacterCount);
    fact("Maximum input characters", inputDecision.maximumInputCharacters);
    fact(
      "Prompt-injection detection enabled",
      yesNo(inputDecision.promptInjectionDetectionEnabled),
    );
  } else lines.push("- Input guardrail decision unavailable because the stage was not reached.");
  const retrieval = model.runEvidence.retrievalEvidence;
  if (retrieval) {
    fact("Retrieval status", retrieval.status);
    fact("Retrieval code", retrieval.code);
    fact("Retrieval explanation", retrieval.explanation);
    fact("Requested top K", retrieval.requestedTopK);
    fact("Returned chunk count", retrieval.returnedChunkCount);
    fact("Minimum relevance threshold", retrieval.minimumRelevanceThreshold);
    fact("Maximum context characters", retrieval.maximumContextCharacters);
    fact("Minimum aggregate relevance", retrieval.relevance.minimum);
    fact("Maximum aggregate relevance", retrieval.relevance.maximum);
    fact("Mean aggregate relevance", retrieval.relevance.mean);
  } else
    lines.push("- Aggregate retrieval evidence unavailable because the stage was not reached.");
  const outputDecision = model.runEvidence.outputGuardrailDecision;
  if (outputDecision) {
    fact("Output guardrail status", outputDecision.status);
    fact("Output guardrail code", outputDecision.code);
    fact("Output guardrail explanation", outputDecision.explanation);
    fact("Schema validated", yesNo(outputDecision.schemaValidated));
    fact("Citations required", yesNo(outputDecision.citationsRequired));
    fact("Citations validated", yesNo(outputDecision.citationsValidated));
    fact("Accepted citation count", outputDecision.acceptedCitationCount);
    fact("Active content detected", yesNo(outputDecision.activeContentDetected));
    fact("Sensitive data detected", yesNo(outputDecision.sensitiveDataDetected));
    fact("Insufficient context", yesNo(outputDecision.insufficientContext));
  } else lines.push("- Output guardrail decision unavailable because the stage was not reached.");
  lines.push("");

  section("Deterministic evaluator results");
  if (!model.runEvidence.evaluatorResults) lines.push("- Evaluators were not reached.", "");
  for (const result of model.runEvidence.evaluatorResults ?? []) {
    fact("Evaluator ID", result.evaluatorId);
    fact("Status", result.status);
    fact("Score", result.score);
    fact("Threshold", result.threshold);
    fact("Fixed explanation", result.explanation);
    lines.push("");
  }

  section("Usage, duration, and cost");
  fact("Total duration milliseconds", model.runEvidence.metrics.totalDurationMs);
  if (model.runEvidence.metrics.providerDurationMs !== undefined) {
    fact("Provider duration milliseconds", model.runEvidence.metrics.providerDurationMs);
  }
  const usage = model.runEvidence.metrics.usage;
  if (usage) {
    fact("Input tokens", usage.inputTokens);
    fact("Output tokens", usage.outputTokens);
    fact("Total tokens", usage.totalTokens);
  } else lines.push("- Token usage unavailable for this terminal result.");
  fact("Estimated cost USD", model.runEvidence.metrics.estimatedCostUsd);
  fact("External API cost USD", model.runEvidence.metrics.externalApiCostUsd);
  fact("Local compute cost measured", yesNo(model.runEvidence.metrics.localComputeCostMeasured));
  lines.push("");

  section("Database and execution controls");
  const controls = model.runEvidence.securityControls;
  fact("Model calls server-side", yesNo(controls.modelCallsServerSide));
  fact("Provider selection exposed to browser", yesNo(controls.providerSelectionExposedToBrowser));
  fact("Credentials stored", yesNo(controls.credentialsStored));
  fact("Prompts stored", yesNo(controls.promptsStored));
  fact("Raw errors stored", yesNo(controls.rawErrorsStored));
  fact("Database opened", yesNo(controls.databaseOpened));
  fact("Database queried", yesNo(controls.databaseQueried));
  fact("Remote tracing used", yesNo(controls.remoteTracingUsed));
  fact("Persistence used", yesNo(controls.persistenceUsed));
  fact("Tools used", yesNo(controls.toolsUsed));
  fact("Handoffs used", yesNo(controls.handoffsUsed));
  fact("Thinking stored", yesNo(controls.thinkingStored));
  lines.push(
    "",
    "- The relational database was not opened.",
    "- The relational database was not queried.",
    "",
  );

  section("Limitations and non-claims");
  lines.push(
    "- Deterministic evaluators do not establish factual truth or semantic correctness.",
    "- This artifact does not establish legal compliance, certification, or security approval.",
    "- This artifact is not a penetration test, human review, or signed attestation.",
    "- Simulated and roadmap nodes were not executed.",
    "- Optional GPT-5.6 is not demonstrated or enabled.",
    "- Deterministic browser fixtures are test infrastructure rather than live-provider evidence.",
    "",
  );
  return lines.join("\n");
}

export async function generateArchitectureAssurance(
  currentWorkflowInput: unknown,
  architectureReportInput: unknown,
  binding: AssuranceRunBinding | undefined,
): Promise<ExportResult> {
  const prepared = prepareAssurance(currentWorkflowInput, binding);
  if (!prepared.success) return prepared;
  const filename = createArtifactFilename(
    prepared.data.submittedWorkflow.workflowId,
    ARCHITECTURE_ASSURANCE_ARTIFACT_TYPE,
  );
  if (!filename.success) return filename;
  try {
    const viewModel = await buildAssuranceViewModel(prepared.data, architectureReportInput);
    if (!viewModel.success) return viewModel;
    const text = renderArchitectureAssuranceMarkdown(viewModel.model);
    const artifact = downloadableTextArtifactSchema.safeParse({
      artifactType: ARCHITECTURE_ASSURANCE_ARTIFACT_TYPE,
      schemaVersion: ARCHITECTURE_ASSURANCE_SCHEMA_VERSION,
      filename: filename.filename,
      mimeType: ARCHITECTURE_ASSURANCE_MIME_TYPE,
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
