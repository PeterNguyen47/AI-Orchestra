"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { humanizeNodeType } from "@/domain/orchestrator/node-catalog";
import type { CanvasNode } from "@/domain/orchestrator/workflow-adapter";

export function WorkflowNode({ data, selected }: NodeProps<CanvasNode>) {
  const node = data.workflowNode;
  const inputs = node.ports.filter((port) => port.direction === "input");
  const outputs = node.ports.filter((port) => port.direction === "output");

  return (
    <article
      className={`workflow-node status-${node.implementationStatus}${selected ? " is-selected" : ""}`}
      data-testid={`workflow-node-${node.id}`}
    >
      <header>
        <span className="node-type">{humanizeNodeType(node.type)}</span>
        <strong>{node.label}</strong>
      </header>
      {data.onKeyboardSelect ? (
        <button
          className="node-select-button nodrag nopan"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            data.onKeyboardSelect?.();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              data.onKeyboardSelect?.();
            }
          }}
        >
          Select {node.label}
        </button>
      ) : null}
      <div className="node-claims">
        <span>{node.implementationStatus}</span>
        <span>{node.security.dataClassification}</span>
        <span>{node.security.trustZone.replaceAll("_", " ")}</span>
      </div>
      <div className="node-ports" aria-label="Component ports">
        <div>
          <b>Inputs</b>
          {inputs.length === 0 ? <small>None</small> : null}
          {inputs.map((port, index) => (
            <span key={port.id} className="port-label port-input">
              <Handle
                id={port.id}
                type="target"
                position={Position.Left}
                style={{ top: `${35 + index * 16}%` }}
              />
              {port.id} <small>{port.dataContract}</small>
            </span>
          ))}
        </div>
        <div>
          <b>Outputs</b>
          {outputs.length === 0 ? <small>None</small> : null}
          {outputs.map((port, index) => (
            <span key={port.id} className="port-label port-output">
              {port.id} <small>{port.dataContract}</small>
              <Handle
                id={port.id}
                type="source"
                position={Position.Right}
                style={{ top: `${35 + index * 16}%` }}
              />
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
