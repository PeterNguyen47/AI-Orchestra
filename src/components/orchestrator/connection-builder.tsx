"use client";

import { useMemo, useState } from "react";
import type { ConnectionRequest } from "@/domain/orchestrator/connection-rules";
import type { Workflow } from "@/domain/workflow/workflow-types";

export function ConnectionBuilder({
  workflow,
  onConnect,
}: Readonly<{ workflow: Workflow; onConnect: (request: ConnectionRequest) => void }>) {
  const [sourceNodeId, setSourceNodeId] = useState("");
  const [sourcePortId, setSourcePortId] = useState("");
  const [targetNodeId, setTargetNodeId] = useState("");
  const [targetPortId, setTargetPortId] = useState("");
  const sourcePorts = useMemo(
    () =>
      workflow.nodes
        .find((node) => node.id === sourceNodeId)
        ?.ports.filter((port) => port.direction === "output") ?? [],
    [sourceNodeId, workflow.nodes],
  );
  const targetPorts = useMemo(
    () =>
      workflow.nodes
        .find((node) => node.id === targetNodeId)
        ?.ports.filter((port) => port.direction === "input") ?? [],
    [targetNodeId, workflow.nodes],
  );

  return (
    <form
      className="connection-builder"
      onSubmit={(event) => {
        event.preventDefault();
        onConnect({ sourceNodeId, sourcePortId, targetNodeId, targetPortId });
      }}
    >
      <div className="section-heading compact">
        <p className="panel-kicker">Accessible connection builder</p>
        <h2>Connect compatible ports</h2>
      </div>
      <label>
        Source component
        <select
          value={sourceNodeId}
          onChange={(event) => {
            setSourceNodeId(event.target.value);
            setSourcePortId("");
          }}
          required
        >
          <option value="">Choose source</option>
          {workflow.nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Source output port
        <select
          value={sourcePortId}
          onChange={(event) => setSourcePortId(event.target.value)}
          required
        >
          <option value="">Choose output</option>
          {sourcePorts.map((port) => (
            <option key={port.id} value={port.id}>
              {port.id} ({port.dataContract})
            </option>
          ))}
        </select>
      </label>
      <label>
        Target component
        <select
          value={targetNodeId}
          onChange={(event) => {
            setTargetNodeId(event.target.value);
            setTargetPortId("");
          }}
          required
        >
          <option value="">Choose target</option>
          {workflow.nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Target input port
        <select
          value={targetPortId}
          onChange={(event) => setTargetPortId(event.target.value)}
          required
        >
          <option value="">Choose input</option>
          {targetPorts.map((port) => (
            <option key={port.id} value={port.id}>
              {port.id} ({port.dataContract})
            </option>
          ))}
        </select>
      </label>
      <button className="primary-button" type="submit">
        Create compatible connection
      </button>
    </form>
  );
}
