"use client";

import { useMemo, useState } from "react";
import type { Connection } from "@xyflow/react";
import { ConnectionBuilder } from "./connection-builder";
import { NodeToolbox } from "./node-toolbox";
import { SelectionInspector } from "./selection-inspector";
import { WorkflowCanvas } from "./workflow-canvas";
import { WorkflowStatus } from "./workflow-status";
import {
  addCompatibleConnection,
  connectionFromReactFlow,
  createBrowserEdgeId,
  type ConnectionRequest,
} from "@/domain/orchestrator/connection-rules";
import { createBrowserNodeId } from "@/domain/orchestrator/node-factory";
import {
  addWorkflowNode,
  deleteWorkflowEdge,
  deleteWorkflowNode,
  moveWorkflowNode,
  resetWorkflow,
  type WorkflowMutationResult,
} from "@/domain/orchestrator/workflow-mutations";
import {
  workflowToCanvasEdges,
  workflowToCanvasNodes,
} from "@/domain/orchestrator/workflow-adapter";
import { validateWorkflowSemantics } from "@/domain/workflow/workflow-validator";
import type { NodeType, Workflow, WorkflowPosition } from "@/domain/workflow/workflow-types";

type Selection = Readonly<{ kind: "node" | "edge"; id: string }> | undefined;

export function OrchestratorShell({ initialWorkflow }: Readonly<{ initialWorkflow: Workflow }>) {
  const [workflow, setWorkflow] = useState<Workflow>(() => structuredClone(initialWorkflow));
  const [selection, setSelection] = useState<Selection>();
  const [message, setMessage] = useState("Canonical Enterprise RAG blueprint loaded.");
  const semantic = useMemo(() => validateWorkflowSemantics(workflow), [workflow]);
  const nodes = useMemo(
    () =>
      workflowToCanvasNodes(workflow).map((node) => ({
        ...node,
        selected: selection?.kind === "node" && selection.id === node.id,
      })),
    [selection, workflow],
  );
  const edges = useMemo(
    () =>
      workflowToCanvasEdges(workflow).map((edge) => ({
        ...edge,
        selected: selection?.kind === "edge" && selection.id === edge.id,
      })),
    [selection, workflow],
  );
  const selectedNode =
    selection?.kind === "node"
      ? workflow.nodes.find((node) => node.id === selection.id)
      : undefined;
  const selectedEdge =
    selection?.kind === "edge"
      ? workflow.edges.find((edge) => edge.id === selection.id)
      : undefined;

  function accept(result: WorkflowMutationResult, successMessage: string): boolean {
    if (!result.success) {
      setMessage(result.message);
      return false;
    }
    setWorkflow(result.workflow);
    setMessage(
      `${successMessage} ${result.findingCount === 0 ? "Workflow is valid." : `${result.findingCount} semantic findings.`}`,
    );
    return true;
  }

  function addNode(type: NodeType) {
    const index = workflow.nodes.length - initialWorkflow.nodes.length;
    const position = { x: 620 + (index % 4) * 70, y: 330 + Math.floor(index / 4) * 70 };
    const result = addWorkflowNode(workflow, type, createBrowserNodeId, position);
    if (accept(result, "Component added.") && result.success) {
      setSelection({ kind: "node", id: result.workflow.nodes.at(-1)!.id });
    }
  }

  function connect(request: ConnectionRequest) {
    const result = addCompatibleConnection(workflow, request, createBrowserEdgeId);
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    setWorkflow(result.workflow);
    setSelection({ kind: "edge", id: result.edge.id });
    setMessage(
      `${result.edge.mode === "runtime" ? "Runtime" : "Advisory"} connection created. Workflow is valid.`,
    );
  }

  function connectFromCanvas(connection: Connection) {
    const request = connectionFromReactFlow(connection);
    if (request === undefined) {
      setMessage("Choose a specific output and input port.");
      return;
    }
    connect(request);
  }

  function moveNode(id: string, position: WorkflowPosition) {
    accept(moveWorkflowNode(workflow, id, position), "Component moved.");
  }

  function deleteSelection(
    nodeIds = selection?.kind === "node" ? [selection.id] : [],
    edgeIds = selection?.kind === "edge" ? [selection.id] : [],
  ) {
    if (nodeIds[0]) {
      if (
        accept(
          deleteWorkflowNode(workflow, nodeIds[0]),
          "Component and incident connections deleted.",
        )
      )
        setSelection(undefined);
      return;
    }
    if (edgeIds[0]) {
      if (accept(deleteWorkflowEdge(workflow, edgeIds[0]), "Connection deleted."))
        setSelection(undefined);
      return;
    }
    setMessage("Select a component or connection before deleting.");
  }

  function reset() {
    const result = resetWorkflow(initialWorkflow);
    if (accept(result, "Canonical template restored.")) setSelection(undefined);
  }

  function moveSelected(deltaX: number, deltaY: number) {
    if (!selectedNode) {
      setMessage("Select a component before moving it.");
      return;
    }
    moveNode(selectedNode.id, {
      x: selectedNode.position.x + deltaX,
      y: selectedNode.position.y + deltaY,
    });
  }

  return (
    <main className="orchestrator-shell" id="main-content">
      <section className="orchestrator-hero" aria-labelledby="orchestrator-title">
        <div>
          <p className="eyebrow">Visual composition · AO-005</p>
          <h1 id="orchestrator-title">Enterprise RAG orchestrator</h1>
          <p>
            Select, move, add, connect, delete, and reset canonical workflow elements without
            overstating runtime capability.
          </p>
        </div>
        <div className="non-persistence-notice" role="note">
          <strong>In-memory only</strong>
          <span>Changes are not persisted. Reloading restores the committed template.</span>
        </div>
      </section>
      <WorkflowStatus
        nodeCount={workflow.nodes.length}
        edgeCount={workflow.edges.length}
        findingCount={semantic.findings.length}
      />
      <p
        className="mutation-message"
        aria-live="polite"
        aria-atomic="true"
        data-testid="mutation-message"
      >
        {message}
      </p>
      <div className="orchestrator-grid">
        <NodeToolbox onAdd={addNode} />
        <section className="canvas-region" aria-label="Workflow editing region">
          <div className="canvas-actions" aria-label="Selected-element actions">
            <button className="secondary-button" type="button" onClick={() => moveSelected(-20, 0)}>
              Move selected left
            </button>
            <button className="secondary-button" type="button" onClick={() => moveSelected(20, 0)}>
              Move selected right
            </button>
            <button className="secondary-button" type="button" onClick={() => moveSelected(0, -20)}>
              Move selected up
            </button>
            <button className="secondary-button" type="button" onClick={() => moveSelected(0, 20)}>
              Move selected down
            </button>
            <button
              className="secondary-button danger-button"
              type="button"
              onClick={() => deleteSelection()}
            >
              Delete selected
            </button>
            <button className="secondary-button" type="button" onClick={reset}>
              Reset to template
            </button>
          </div>
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onMove={moveNode}
            onConnect={connectFromCanvas}
            onDelete={deleteSelection}
            onSelection={setSelection}
          />
        </section>
        <SelectionInspector node={selectedNode} edge={selectedEdge} />
      </div>
      <ConnectionBuilder workflow={workflow} onConnect={connect} />
    </main>
  );
}
