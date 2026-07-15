import type { Connection } from "@xyflow/react";
import { parseWorkflow } from "@/domain/workflow/workflow-parser";
import { validateWorkflowSemantics } from "@/domain/workflow/workflow-validator";
import type {
  EdgeMode,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowPort,
} from "@/domain/workflow/workflow-types";

export type EdgeIdGenerator = () => string;

export type ConnectionRequest = Readonly<{
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}>;

export type ConnectionResult =
  | Readonly<{ success: true; workflow: Workflow; edge: WorkflowEdge }>
  | Readonly<{ success: false; message: string }>;

function findNode(workflow: Workflow, id: string): WorkflowNode | undefined {
  return workflow.nodes.find((node) => node.id === id);
}

function findPort(node: WorkflowNode, id: string): WorkflowPort | undefined {
  return node.ports.find((port) => port.id === id);
}

function edgeMode(source: WorkflowNode, target: WorkflowNode): EdgeMode {
  return source.implementationStatus === "executable" &&
    target.implementationStatus === "executable"
    ? "runtime"
    : "advisory";
}

export function addCompatibleConnection(
  workflow: Workflow,
  request: ConnectionRequest,
  idGenerator: EdgeIdGenerator,
): ConnectionResult {
  const source = findNode(workflow, request.sourceNodeId);
  const target = findNode(workflow, request.targetNodeId);
  if (source === undefined || target === undefined) {
    return { success: false, message: "Choose existing source and target components." };
  }
  if (source.id === target.id) {
    return { success: false, message: "A component cannot connect to itself." };
  }

  const sourcePort = findPort(source, request.sourcePortId);
  const targetPort = findPort(target, request.targetPortId);
  if (sourcePort?.direction !== "output" || targetPort?.direction !== "input") {
    return {
      success: false,
      message: "Connections must run from an output port to an input port.",
    };
  }
  if (sourcePort.dataContract !== targetPort.dataContract) {
    return { success: false, message: "The selected ports use incompatible data contracts." };
  }
  const duplicate = workflow.edges.some(
    (edge) =>
      edge.sourceNodeId === source.id &&
      edge.sourcePortId === sourcePort.id &&
      edge.targetNodeId === target.id &&
      edge.targetPortId === targetPort.id,
  );
  if (duplicate) {
    return { success: false, message: "That logical connection already exists." };
  }

  const mode = edgeMode(source, target);
  const edge: WorkflowEdge = {
    id: idGenerator().toLowerCase(),
    sourceNodeId: source.id,
    sourcePortId: sourcePort.id,
    targetNodeId: target.id,
    targetPortId: targetPort.id,
    mode,
    dataContract: sourcePort.dataContract,
    label: `${source.label} to ${target.label}`,
  };
  const parsed = parseWorkflow({ ...workflow, edges: [...workflow.edges, edge] });
  if (!parsed.success) {
    return {
      success: false,
      message: "The connection would make the workflow structurally invalid.",
    };
  }
  const semantics = validateWorkflowSemantics(parsed.data);
  if (!semantics.valid) {
    return {
      success: false,
      message: "The connection conflicts with the canonical workflow rules.",
    };
  }
  return { success: true, workflow: parsed.data, edge };
}

export function connectionFromReactFlow(connection: Connection): ConnectionRequest | undefined {
  if (
    connection.source === null ||
    connection.target === null ||
    connection.sourceHandle === null ||
    connection.targetHandle === null
  ) {
    return undefined;
  }
  return {
    sourceNodeId: connection.source,
    sourcePortId: connection.sourceHandle,
    targetNodeId: connection.target,
    targetPortId: connection.targetHandle,
  };
}

export function createBrowserEdgeId(): string {
  return `edge-${crypto.randomUUID().toLowerCase()}`;
}
