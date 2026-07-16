import type { Workflow } from "@/domain/workflow/workflow-types";
import {
  validateCanonicalWorkflowArchitecture,
  validateWorkflowArchitecture,
  type ArchitectureValidationReport,
} from "./architecture-validator";

export type WorkflowExecutionReadiness = Readonly<{
  ready: boolean;
  report: ArchitectureValidationReport;
}>;

export function assessWorkflowExecutionReadiness(input: unknown): WorkflowExecutionReadiness;
export function assessWorkflowExecutionReadiness(input: Workflow): WorkflowExecutionReadiness;
export function assessWorkflowExecutionReadiness(input: unknown): WorkflowExecutionReadiness {
  const report = validateWorkflowArchitecture(input);
  return { ready: report.executionReady, report };
}

export function assessCanonicalWorkflowExecutionReadiness(
  workflow: Workflow,
): WorkflowExecutionReadiness {
  const report = validateCanonicalWorkflowArchitecture(workflow);
  return { ready: report.executionReady, report };
}
