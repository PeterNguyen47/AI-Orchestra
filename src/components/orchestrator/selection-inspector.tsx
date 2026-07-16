import { humanizeNodeType } from "@/domain/orchestrator/node-catalog";
import { NodeConfigurationEditor } from "./node-configuration-editor";
import type {
  ConfigurationFieldErrors,
  EditableNodePayload,
} from "@/domain/orchestrator/configuration-mutations";
import type { Workflow, WorkflowEdge, WorkflowNode } from "@/domain/workflow/workflow-types";

function PortList({
  node,
  direction,
}: Readonly<{ node: WorkflowNode; direction: "input" | "output" }>) {
  const ports = node.ports.filter((port) => port.direction === direction);
  return ports.length === 0 ? (
    <span>None</span>
  ) : (
    <ul>
      {ports.map((port) => (
        <li key={port.id}>
          {port.id} ({port.dataContract})
        </li>
      ))}
    </ul>
  );
}

export function SelectionInspector({
  node,
  edge,
  workflow,
  canonicalWorkflow,
  onApply,
  onDirtyChange,
}: Readonly<{
  node?: WorkflowNode | undefined;
  edge?: WorkflowEdge | undefined;
  workflow: Workflow;
  canonicalWorkflow: Workflow;
  onApply: (payload: EditableNodePayload) => ConfigurationFieldErrors | undefined;
  onDirtyChange: (dirty: boolean) => void;
}>) {
  return (
    <aside className="orchestrator-panel inspector" aria-labelledby="inspector-title">
      <p className="panel-kicker">{node ? "Inspector and editor" : "Read-only inspector"}</p>
      <h2 id="inspector-title">Selection</h2>
      {node ? (
        <>
          <dl data-testid="node-inspector">
            <div>
              <dt>Label</dt>
              <dd>{node.label}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{humanizeNodeType(node.type)}</dd>
            </div>
            <div>
              <dt>Implementation status</dt>
              <dd>{node.implementationStatus}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{node.description}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>
                {node.position.x}, {node.position.y}
              </dd>
            </div>
            <div>
              <dt>Data classification</dt>
              <dd>{node.security.dataClassification}</dd>
            </div>
            <div>
              <dt>Trust zone</dt>
              <dd>{node.security.trustZone}</dd>
            </div>
            <div>
              <dt>Input ports</dt>
              <dd>
                <PortList node={node} direction="input" />
              </dd>
            </div>
            <div>
              <dt>Output ports</dt>
              <dd>
                <PortList node={node} direction="output" />
              </dd>
            </div>
            <div>
              <dt>Documentation</dt>
              <dd>{node.documentationRef}</dd>
            </div>
          </dl>
          <NodeConfigurationEditor
            key={node.id}
            node={node}
            workflow={workflow}
            canonicalWorkflow={canonicalWorkflow}
            onApply={onApply}
            onDirtyChange={onDirtyChange}
          />
        </>
      ) : edge ? (
        <dl data-testid="edge-inspector">
          <div>
            <dt>Label</dt>
            <dd>{edge.label}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{edge.mode}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              {edge.sourceNodeId}.{edge.sourcePortId}
            </dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>
              {edge.targetNodeId}.{edge.targetPortId}
            </dd>
          </div>
          <div>
            <dt>Data contract</dt>
            <dd>{edge.dataContract}</dd>
          </div>
        </dl>
      ) : (
        <p>Select a component or connection on the canvas to inspect its canonical metadata.</p>
      )}
    </aside>
  );
}
