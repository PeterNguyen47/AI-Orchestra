import type { Workflow, WorkflowEdge, WorkflowNode } from "@/domain/workflow/workflow-types";
import type {
  WorkflowValidationCategory,
  WorkflowValidationSeverity,
  WorkflowValidationSubject,
} from "@/domain/workflow/workflow-validator";

export const ARCHITECTURE_VALIDATION_CODES = {
  missingRequiredControl: "MISSING_REQUIRED_CONTROL",
  unapprovedTool: "UNAPPROVED_TOOL",
  citationPolicyMismatch: "CITATION_POLICY_MISMATCH",
  classificationMismatch: "CLASSIFICATION_MISMATCH",
  classificationDowngrade: "CLASSIFICATION_DOWNGRADE",
  guardrailLengthMismatch: "GUARDRAIL_LENGTH_MISMATCH",
  externalConfidentialData: "EXTERNAL_CONFIDENTIAL_DATA",
  unboundedReasoningProfile: "UNBOUNDED_REASONING_PROFILE",
  evaluationThresholdInconsistency: "EVALUATION_THRESHOLD_INCONSISTENCY",
  uploadSourceUnsupported: "UPLOAD_SOURCE_UNSUPPORTED",
} as const;

export type ArchitectureRuleCode =
  (typeof ARCHITECTURE_VALIDATION_CODES)[keyof typeof ARCHITECTURE_VALIDATION_CODES];

export type ArchitectureRuleFinding = Readonly<{
  code: ArchitectureRuleCode;
  category: WorkflowValidationCategory;
  severity: WorkflowValidationSeverity;
  path: string;
  message: string;
  remediation: string;
  subject: WorkflowValidationSubject;
}>;

export const CLASSIFICATION_RANK = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
} as const;

export function compareClassifications(
  left: keyof typeof CLASSIFICATION_RANK,
  right: keyof typeof CLASSIFICATION_RANK,
): number {
  return CLASSIFICATION_RANK[left] - CLASSIFICATION_RANK[right];
}

function nodeFinding(
  code: ArchitectureRuleCode,
  severity: WorkflowValidationSeverity,
  node: WorkflowNode,
  index: number,
  path: string,
  message: string,
  remediation: string,
  category: WorkflowValidationCategory = "governance",
): ArchitectureRuleFinding {
  return {
    code,
    severity,
    category,
    path: `$.nodes[${index}].${path}`,
    message,
    remediation,
    subject: { kind: "node", id: node.id },
  };
}

function edgeFinding(
  code: ArchitectureRuleCode,
  edge: WorkflowEdge,
  index: number,
  message: string,
  remediation: string,
): ArchitectureRuleFinding {
  return {
    code,
    severity: "error",
    category: "security",
    path: `$.edges[${index}]`,
    message,
    remediation,
    subject: { kind: "edge", id: edge.id },
  };
}

function runtimePathNodeIds(workflow: Workflow): Set<string> {
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  const forward = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    const source = nodes.get(edge.sourceNodeId);
    const target = nodes.get(edge.targetNodeId);
    if (
      edge.mode !== "runtime" ||
      source?.implementationStatus !== "executable" ||
      target?.implementationStatus !== "executable"
    )
      continue;
    forward.set(source.id, [...(forward.get(source.id) ?? []), target.id]);
    reverse.set(target.id, [...(reverse.get(target.id) ?? []), source.id]);
  }
  const walk = (seeds: string[], graph: Map<string, string[]>) => {
    const found = new Set<string>();
    const queue = [...seeds].sort();
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index]!;
      if (found.has(id)) continue;
      found.add(id);
      queue.push(...(graph.get(id) ?? []).filter((next) => !found.has(next)).sort());
    }
    return found;
  };
  const fromInput = walk(
    workflow.nodes.filter((node) => node.type === "user_input").map((node) => node.id),
    forward,
  );
  const toOutput = walk(
    workflow.nodes.filter((node) => node.type === "response_output").map((node) => node.id),
    reverse,
  );
  return new Set([...fromInput].filter((id) => toOutput.has(id)));
}

export function validateArchitectureRules(
  workflow: Workflow,
): ReadonlyArray<ArchitectureRuleFinding> {
  const findings: ArchitectureRuleFinding[] = [];
  const pathIds = runtimePathNodeIds(workflow);
  const requiredTypes = [
    "input_guardrail",
    "retrieval",
    "gpt_agent",
    "output_guardrail",
    "evaluator",
  ] as const;
  for (const type of requiredTypes) {
    if (!workflow.nodes.some((node) => node.type === type && pathIds.has(node.id))) {
      findings.push({
        code: ARCHITECTURE_VALIDATION_CODES.missingRequiredControl,
        severity: "error",
        category: "readiness",
        path: "$.nodes",
        message: `The executable runtime path is missing a connected ${type} control.`,
        remediation: "Add and correctly connect the missing required control.",
        subject: { kind: "workflow" },
      });
    }
  }

  workflow.nodes.forEach((node, nodeIndex) => {
    if (node.type === "document_source" && node.configuration.sourceMode === "upload") {
      findings.push(
        nodeFinding(
          ARCHITECTURE_VALIDATION_CODES.uploadSourceUnsupported,
          "error",
          node,
          nodeIndex,
          "configuration.sourceMode",
          "Document upload is not executable on the MVP judge path.",
          "Use the approved bundled document source for governed execution.",
          "readiness",
        ),
      );
    }
    if (node.type === "gpt_agent") {
      if (node.configuration.allowedTools.length > 0) {
        findings.push(
          nodeFinding(
            ARCHITECTURE_VALIDATION_CODES.unapprovedTool,
            "error",
            node,
            nodeIndex,
            "configuration.allowedTools",
            "Arbitrary GPT tools are not approved for this MVP.",
            "Remove tool identifiers. Arbitrary tool execution is not approved for this MVP.",
          ),
        );
      }
      if (
        node.configuration.reasoningEffort === "high" &&
        node.configuration.maximumOutputTokens > 64_000
      ) {
        findings.push(
          nodeFinding(
            ARCHITECTURE_VALIDATION_CODES.unboundedReasoningProfile,
            "warning",
            node,
            nodeIndex,
            "configuration.maximumOutputTokens",
            "High reasoning effort and a very large output limit may create avoidable cost.",
            "Reduce reasoning effort or maximum output tokens for the intended use case.",
            "configuration",
          ),
        );
      }
    }
    if (
      (node.type === "document_source" || node.type === "relational_database") &&
      node.configuration.dataClassification !== node.security.dataClassification
    ) {
      findings.push(
        nodeFinding(
          ARCHITECTURE_VALIDATION_CODES.classificationMismatch,
          "error",
          node,
          nodeIndex,
          "configuration.dataClassification",
          "Configuration classification does not match node security classification.",
          "Align the configuration and node security classifications.",
          "security",
        ),
      );
    }
    if (node.type === "evaluator") {
      const values = Object.values(node.configuration.metricThresholds);
      if (
        node.configuration.overallPassThreshold < Math.min(...values) ||
        node.configuration.overallPassThreshold > Math.max(...values)
      ) {
        findings.push(
          nodeFinding(
            ARCHITECTURE_VALIDATION_CODES.evaluationThresholdInconsistency,
            "warning",
            node,
            nodeIndex,
            "configuration.overallPassThreshold",
            "The overall threshold falls outside the individual metric-threshold range.",
            "Review the overall and per-metric thresholds for a clear pass policy.",
            "configuration",
          ),
        );
      }
    }
  });

  const citationMetricRequired = workflow.nodes.some(
    (node) => node.type === "evaluator" && node.configuration.requiredMetrics.citation_coverage,
  );
  if (citationMetricRequired) {
    workflow.nodes.forEach((node, nodeIndex) => {
      if (
        (node.type === "retrieval" || node.type === "output_guardrail") &&
        !node.configuration.citationsRequired
      ) {
        findings.push(
          nodeFinding(
            ARCHITECTURE_VALIDATION_CODES.citationPolicyMismatch,
            "error",
            node,
            nodeIndex,
            "configuration.citationsRequired",
            "Citation coverage is required by evaluation, but citations are disabled here.",
            "Enable citations on retrieval and output guardrails.",
          ),
        );
      }
    });
  }

  const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));
  workflow.edges.forEach((edge, edgeIndex) => {
    if (edge.mode !== "runtime") return;
    const source = nodeById.get(edge.sourceNodeId);
    const target = nodeById.get(edge.targetNodeId);
    if (!source || !target) return;
    if (
      compareClassifications(
        source.security.dataClassification,
        target.security.dataClassification,
      ) > 0
    ) {
      findings.push(
        edgeFinding(
          ARCHITECTURE_VALIDATION_CODES.classificationDowngrade,
          edge,
          edgeIndex,
          `Runtime data moves from ${source.security.dataClassification} to lower-classified ${target.security.dataClassification}.`,
          "Raise the target classification or redesign the data flow.",
        ),
      );
    }
    if (
      target.security.trustZone === "external_service" &&
      compareClassifications(source.security.dataClassification, "confidential") >= 0
    ) {
      findings.push({
        code: ARCHITECTURE_VALIDATION_CODES.externalConfidentialData,
        severity: "warning",
        category: "security",
        path: `$.edges[${edgeIndex}]`,
        message: "Confidential data enters an external-service trust zone and requires review.",
        remediation:
          "Confirm approved model handling, redaction, and contractual controls before production use.",
        subject: { kind: "edge", id: edge.id },
      });
    }
    if (source.type === "user_input" && target.type === "input_guardrail") {
      if (target.configuration.maximumInputLength < source.configuration.maximumInputLength) {
        findings.push(
          nodeFinding(
            ARCHITECTURE_VALIDATION_CODES.guardrailLengthMismatch,
            "warning",
            target,
            workflow.nodes.indexOf(target),
            "configuration.maximumInputLength",
            "The input guardrail maximum is lower than the connected user-input maximum.",
            "Align the maximum lengths or document the deliberate restriction.",
            "configuration",
          ),
        );
      }
    }
  });
  return findings;
}
