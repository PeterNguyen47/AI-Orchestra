import { getNodeCatalogEntry } from "./node-catalog";
import { parseWorkflow } from "@/domain/workflow/workflow-parser";
import type {
  NodeType,
  Workflow,
  WorkflowNode,
  WorkflowPosition,
} from "@/domain/workflow/workflow-types";

export type NodeIdGenerator = () => string;

function cloneNode(node: WorkflowNode): WorkflowNode {
  return structuredClone(node);
}

export function createWorkflowNode(
  workflow: Workflow,
  type: NodeType,
  idGenerator: NodeIdGenerator,
  position: WorkflowPosition,
): WorkflowNode {
  const prototype = workflow.nodes.find((node) => node.type === type);
  if (prototype === undefined) {
    throw new Error(`The canonical workflow has no prototype for ${type}.`);
  }

  const id = idGenerator().toLowerCase();
  const catalog = getNodeCatalogEntry(type);
  const candidate = {
    ...cloneNode(prototype),
    id,
    label:
      type === "relational_database" ? `Simulated ${catalog.label}` : `Roadmap ${catalog.label}`,
    description: `${catalog.description} Added in-memory for visual composition only.`,
    implementationStatus: type === "relational_database" ? "simulated" : "roadmap",
    position: { ...position },
  } as WorkflowNode;

  const parsed = parseWorkflow({ ...workflow, nodes: [...workflow.nodes, candidate] });
  if (!parsed.success) {
    throw new Error("The node factory produced an invalid canonical workflow node.");
  }

  return parsed.data.nodes.at(-1)!;
}

export function createBrowserNodeId(): string {
  return `node-${crypto.randomUUID().toLowerCase()}`;
}
