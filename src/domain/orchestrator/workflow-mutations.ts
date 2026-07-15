import { createWorkflowNode, type NodeIdGenerator } from "./node-factory";
import { parseWorkflow } from "@/domain/workflow/workflow-parser";
import { validateWorkflowSemantics } from "@/domain/workflow/workflow-validator";
import type { NodeType, Workflow, WorkflowPosition } from "@/domain/workflow/workflow-types";

export type WorkflowMutationResult =
  | Readonly<{
      success: true;
      workflow: Workflow;
      findingCount: number;
    }>
  | Readonly<{ success: false; message: string }>;

function acceptCandidate(candidate: unknown): WorkflowMutationResult {
  const parsed = parseWorkflow(candidate);
  if (!parsed.success) {
    return {
      success: false,
      message: "The edit was rejected because it would corrupt workflow structure.",
    };
  }
  const semantic = validateWorkflowSemantics(parsed.data);
  return { success: true, workflow: parsed.data, findingCount: semantic.findings.length };
}

export function moveWorkflowNode(
  workflow: Workflow,
  nodeId: string,
  position: WorkflowPosition,
): WorkflowMutationResult {
  if (!workflow.nodes.some((node) => node.id === nodeId)) {
    return { success: false, message: "The selected component no longer exists." };
  }
  return acceptCandidate({
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === nodeId ? { ...node, position: { ...position } } : node,
    ),
  });
}

export function addWorkflowNode(
  workflow: Workflow,
  type: NodeType,
  idGenerator: NodeIdGenerator,
  position: WorkflowPosition,
): WorkflowMutationResult {
  try {
    const node = createWorkflowNode(workflow, type, idGenerator, position);
    return acceptCandidate({ ...workflow, nodes: [...workflow.nodes, node] });
  } catch {
    return { success: false, message: "The component could not be created safely." };
  }
}

export function deleteWorkflowNode(workflow: Workflow, nodeId: string): WorkflowMutationResult {
  if (!workflow.nodes.some((node) => node.id === nodeId)) {
    return { success: false, message: "The selected component no longer exists." };
  }
  return acceptCandidate({
    ...workflow,
    nodes: workflow.nodes.filter((node) => node.id !== nodeId),
    edges: workflow.edges.filter(
      (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
    ),
  });
}

export function deleteWorkflowEdge(workflow: Workflow, edgeId: string): WorkflowMutationResult {
  if (!workflow.edges.some((edge) => edge.id === edgeId)) {
    return { success: false, message: "The selected connection no longer exists." };
  }
  return acceptCandidate({
    ...workflow,
    edges: workflow.edges.filter((edge) => edge.id !== edgeId),
  });
}

export function resetWorkflow(canonicalWorkflow: Workflow): WorkflowMutationResult {
  return acceptCandidate(structuredClone(canonicalWorkflow));
}
