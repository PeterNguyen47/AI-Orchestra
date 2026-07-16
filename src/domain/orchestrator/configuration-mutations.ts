import {
  validateCanonicalWorkflowArchitecture,
  type ArchitectureValidationReport,
} from "@/domain/validation/architecture-validator";
import { parseWorkflow } from "@/domain/workflow/workflow-parser";
import type { Workflow, WorkflowNode } from "@/domain/workflow/workflow-types";

export type EditableNodePayload = Readonly<{
  label: string;
  description: string;
  security: WorkflowNode["security"];
  documentationRef: string;
  configuration: WorkflowNode["configuration"];
}>;

export type ConfigurationFieldErrors = Readonly<Record<string, ReadonlyArray<string>>>;

export type ConfigurationMutationResult =
  | Readonly<{ success: true; workflow: Workflow; report: ArchitectureValidationReport }>
  | Readonly<{ success: false; workflow: Workflow; fieldErrors: ConfigurationFieldErrors }>;

function formPath(path: ReadonlyArray<string | number>, nodeIndex: number): string {
  const prefix = ["nodes", nodeIndex];
  const relevant = path[0] === prefix[0] && path[1] === prefix[1] ? path.slice(2) : path;
  return relevant.map(String).join(".");
}

export function updateWorkflowNodeConfiguration(
  workflow: Workflow,
  nodeId: string,
  payload: EditableNodePayload,
): ConfigurationMutationResult {
  const nodeIndex = workflow.nodes.findIndex((node) => node.id === nodeId);
  if (nodeIndex < 0) {
    return {
      success: false,
      workflow,
      fieldErrors: { node: ["The selected component no longer exists."] },
    };
  }
  const current = workflow.nodes[nodeIndex]!;
  const candidateNode = {
    ...current,
    label: payload.label,
    description: payload.description,
    security: structuredClone(payload.security),
    documentationRef: payload.documentationRef,
    configuration: structuredClone(payload.configuration),
  };
  const candidate = {
    ...workflow,
    nodes: workflow.nodes.map((node, index) => (index === nodeIndex ? candidateNode : node)),
  };
  const parsed = parseWorkflow(candidate);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.issues) {
      const path = formPath(issue.path, nodeIndex) || "node";
      errors[path] = [...(errors[path] ?? []), issue.message];
    }
    return { success: false, workflow, fieldErrors: errors };
  }
  return {
    success: true,
    workflow: parsed.data,
    report: validateCanonicalWorkflowArchitecture(parsed.data),
  };
}
