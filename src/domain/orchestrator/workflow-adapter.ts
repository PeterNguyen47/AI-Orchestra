import { Position, type Edge, type Node } from "@xyflow/react";
import type { Workflow, WorkflowEdge, WorkflowNode } from "@/domain/workflow/workflow-types";

export type WorkflowNodeData = Record<string, unknown> &
  Readonly<{ workflowNode: WorkflowNode; onKeyboardSelect?: (() => void) | undefined }>;
export type WorkflowEdgeData = Record<string, unknown> & Readonly<{ workflowEdge: WorkflowEdge }>;
export type CanvasNode = Node<WorkflowNodeData, "workflowNode">;
export type CanvasEdge = Edge<WorkflowEdgeData, "workflowEdge">;

export function workflowNodeAriaLabel(node: WorkflowNode): string {
  return `${node.label}. ${node.type.replaceAll("_", " ")}. ${node.implementationStatus}. ${node.security.dataClassification} data in ${node.security.trustZone.replaceAll("_", " ")}.`;
}

export function workflowEdgeAriaLabel(edge: WorkflowEdge): string {
  return `${edge.label}. ${edge.mode} connection using ${edge.dataContract.replaceAll("_", " ")}.`;
}

export function workflowToCanvasNodes(workflow: Workflow): CanvasNode[] {
  return workflow.nodes.map((node) => {
    let inputIndex = 0;
    let outputIndex = 0;
    return {
      id: node.id,
      type: "workflowNode",
      position: { ...node.position },
      width: 224,
      height: 220,
      handles: node.ports.map((port) => {
        const index = port.direction === "input" ? inputIndex++ : outputIndex++;
        return {
          id: port.id,
          type: port.direction === "input" ? "target" : "source",
          position: port.direction === "input" ? Position.Left : Position.Right,
          x: port.direction === "input" ? 0 : 224,
          y: 77 + index * 35,
          width: 12,
          height: 12,
        };
      }),
      data: { workflowNode: node },
      ariaLabel: workflowNodeAriaLabel(node),
      focusable: true,
      deletable: true,
    };
  });
}

export function workflowToCanvasEdges(workflow: Workflow): CanvasEdge[] {
  return workflow.edges.map((edge) => {
    const presentation: CanvasEdge = {
      id: edge.id,
      type: "workflowEdge",
      source: edge.sourceNodeId,
      sourceHandle: edge.sourcePortId,
      target: edge.targetNodeId,
      targetHandle: edge.targetPortId,
      label: `${edge.mode === "runtime" ? "Runtime" : "Advisory"} · ${edge.dataContract.replaceAll("_", " ")}`,
      data: { workflowEdge: edge },
      ariaLabel: workflowEdgeAriaLabel(edge),
      focusable: true,
      deletable: true,
      ...(edge.mode === "advisory" ? { style: { strokeDasharray: "8 6" } } : {}),
    };
    return presentation;
  });
}
