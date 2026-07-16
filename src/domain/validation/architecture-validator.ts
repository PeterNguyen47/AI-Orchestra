import { parseWorkflow, type WorkflowParseIssue } from "@/domain/workflow/workflow-parser";
import type { Workflow } from "@/domain/workflow/workflow-types";
import {
  validateWorkflowSemantics,
  type WorkflowValidationCategory,
  type WorkflowValidationFinding,
  type WorkflowValidationSeverity,
  type WorkflowValidationSubject,
} from "@/domain/workflow/workflow-validator";
import { validateArchitectureRules, type ArchitectureRuleFinding } from "./architecture-rules";

export type ArchitectureValidationFinding = Readonly<{
  code: string;
  category: WorkflowValidationCategory;
  severity: WorkflowValidationSeverity;
  path: string;
  message: string;
  remediation: string;
  subject: WorkflowValidationSubject;
}>;

export type ArchitectureValidationReport = Readonly<{
  structureValid: boolean;
  architectureValid: boolean;
  executionReady: boolean;
  errorCount: number;
  warningCount: number;
  findings: ReadonlyArray<ArchitectureValidationFinding>;
}>;

const CATEGORY_ORDER: ReadonlyArray<WorkflowValidationCategory> = [
  "structure",
  "graph",
  "configuration",
  "security",
  "governance",
  "readiness",
];

export function workflowPath(path: ReadonlyArray<string | number>): string {
  return path.reduce<string>(
    (result, segment) =>
      typeof segment === "number" ? `${result}[${segment}]` : `${result}.${segment}`,
    "$",
  );
}

function structuralFinding(issue: WorkflowParseIssue): ArchitectureValidationFinding {
  return {
    code: "STRUCTURE_INVALID",
    category: "structure",
    severity: "error",
    path: workflowPath(issue.path),
    message: issue.message,
    remediation: "Correct the field to match the canonical workflow schema.",
    subject: { kind: "workflow" },
  };
}

function stableFindings(
  findings: ReadonlyArray<
    WorkflowValidationFinding | ArchitectureRuleFinding | ArchitectureValidationFinding
  >,
): ArchitectureValidationFinding[] {
  return [...findings].sort((left, right) => {
    const severity = (left.severity === "error" ? 0 : 1) - (right.severity === "error" ? 0 : 1);
    if (severity !== 0) return severity;
    const category = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
    if (category !== 0) return category;
    return (
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message)
    );
  });
}

function report(
  structureValid: boolean,
  findings: ArchitectureValidationFinding[],
): ArchitectureValidationReport {
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const warningCount = findings.length - errorCount;
  return {
    structureValid,
    architectureValid: structureValid && errorCount === 0,
    executionReady: structureValid && errorCount === 0,
    errorCount,
    warningCount,
    findings,
  };
}

export function validateWorkflowArchitecture(input: unknown): ArchitectureValidationReport {
  const parsed = parseWorkflow(input);
  if (!parsed.success) {
    return report(false, stableFindings(parsed.issues.map(structuralFinding)));
  }
  return validateCanonicalWorkflowArchitecture(parsed.data);
}

export function validateCanonicalWorkflowArchitecture(
  workflow: Workflow,
): ArchitectureValidationReport {
  const semantic = validateWorkflowSemantics(workflow);
  const findings = stableFindings([...semantic.findings, ...validateArchitectureRules(workflow)]);
  return report(true, findings);
}
