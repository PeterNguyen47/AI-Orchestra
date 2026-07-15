import type { NodeType } from "@/domain/workflow/workflow-types";

export type NodeCatalogEntry = Readonly<{
  type: NodeType;
  label: string;
  description: string;
}>;

export const NODE_CATALOG = [
  { type: "user_input", label: "User input", description: "Human question entry point." },
  {
    type: "input_guardrail",
    label: "Input guardrail",
    description: "Pre-retrieval policy boundary.",
  },
  {
    type: "document_source",
    label: "Document source",
    description: "Approved knowledge collection.",
  },
  { type: "retrieval", label: "Retrieval", description: "Citation-aware context selection." },
  { type: "gpt_agent", label: "GPT agent", description: "Governed model response step." },
  {
    type: "output_guardrail",
    label: "Output guardrail",
    description: "Post-generation policy boundary.",
  },
  { type: "evaluator", label: "Evaluator", description: "Declared answer-quality thresholds." },
  {
    type: "response_output",
    label: "Response output",
    description: "Final cited answer representation.",
  },
  {
    type: "relational_database",
    label: "Relational database",
    description: "Simulated read-only enterprise data contract.",
  },
] as const satisfies ReadonlyArray<NodeCatalogEntry>;

export function getNodeCatalogEntry(type: NodeType): NodeCatalogEntry {
  const entry = NODE_CATALOG.find((candidate) => candidate.type === type);
  if (entry === undefined) {
    throw new Error(`Unsupported node type: ${type}`);
  }
  return entry;
}

export function humanizeNodeType(type: NodeType): string {
  return getNodeCatalogEntry(type).label;
}
