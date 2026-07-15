"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnDelete,
} from "@xyflow/react";
import { WorkflowEdge } from "./workflow-edge";
import { WorkflowNode } from "./workflow-node";
import type { CanvasEdge, CanvasNode } from "@/domain/orchestrator/workflow-adapter";
import type { WorkflowPosition } from "@/domain/workflow/workflow-types";

type Selection = Readonly<{ kind: "node" | "edge"; id: string }> | undefined;

export function WorkflowCanvas({
  nodes,
  edges,
  onMove,
  onConnect,
  onDelete,
  onSelection,
}: Readonly<{
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onMove: (id: string, position: WorkflowPosition) => void;
  onConnect: (connection: Connection) => void;
  onDelete: (nodeIds: string[], edgeIds: string[]) => void;
  onSelection: (selection: Selection) => void;
}>) {
  const nodeTypes = useMemo(() => ({ workflowNode: WorkflowNode }), []);
  const edgeTypes = useMemo(() => ({ workflowEdge: WorkflowEdge }), []);
  const keyboardNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onKeyboardSelect: () => onSelection({ kind: "node", id: node.id }),
        },
      })),
    [nodes, onSelection],
  );
  const handleNodeChanges = (changes: NodeChange<CanvasNode>[]) => {
    for (const change of changes) {
      if (change.type === "position" && change.position !== undefined) {
        onMove(change.id, change.position);
      }
      if (change.type === "select" && change.selected) {
        onSelection({ kind: "node", id: change.id });
      }
    }
  };
  const handleEdgeChanges = (changes: EdgeChange<CanvasEdge>[]) => {
    for (const change of changes) {
      if (change.type === "select" && change.selected) {
        onSelection({ kind: "edge", id: change.id });
      }
    }
  };
  const handleDelete: OnDelete<CanvasNode, CanvasEdge> = ({
    nodes: deletedNodes,
    edges: deletedEdges,
  }) => {
    onDelete(
      deletedNodes.map((node) => node.id),
      deletedEdges.map((edge) => edge.id),
    );
  };
  return (
    <div
      className="workflow-canvas"
      data-testid="workflow-canvas"
      aria-label="Enterprise RAG workflow canvas"
    >
      <ReactFlow<CanvasNode, CanvasEdge>
        nodes={keyboardNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodeChanges}
        onEdgesChange={handleEdgeChanges}
        onConnect={onConnect}
        onDelete={handleDelete}
        onNodeClick={(_event, node) => onSelection({ kind: "node", id: node.id })}
        onEdgeClick={(_event, edge) => onSelection({ kind: "edge", id: edge.id })}
        onPaneClick={() => onSelection(undefined)}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.2}
        maxZoom={2}
        nodesFocusable
        edgesFocusable
        disableKeyboardA11y={false}
        deleteKeyCode={["Backspace", "Delete"]}
        attributionPosition="bottom-right"
        aria-label="Editable Enterprise RAG architecture"
      >
        <Background color="#36514a" gap={24} />
        <Controls showZoom showFitView showInteractive aria-label="Canvas viewport controls" />
      </ReactFlow>
    </div>
  );
}
