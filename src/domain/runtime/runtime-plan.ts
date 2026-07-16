import { assessCanonicalWorkflowExecutionReadiness } from "@/domain/validation/execution-readiness";
import { parseWorkflow } from "@/domain/workflow/workflow-parser";
import type { Workflow, WorkflowNode } from "@/domain/workflow/workflow-types";
import { OPENAI_GPT56_TARGET, type ResolvedModelTarget } from "./model-runtime";

const REQUIRED_TYPES = [
  "user_input",
  "input_guardrail",
  "document_source",
  "retrieval",
  "gpt_agent",
  "output_guardrail",
  "evaluator",
  "response_output",
] as const;

const REQUIRED_EDGES = [
  ["user_input", "input_guardrail", "user_query"],
  ["input_guardrail", "retrieval", "guarded_query"],
  ["document_source", "retrieval", "document_collection"],
  ["retrieval", "gpt_agent", "retrieval_context"],
  ["gpt_agent", "output_guardrail", "agent_response"],
  ["output_guardrail", "evaluator", "guarded_response"],
  ["evaluator", "response_output", "evaluated_response"],
] as const;

export type RuntimePlan = Readonly<{
  workflow: Workflow;
  nodes: Readonly<Record<(typeof REQUIRED_TYPES)[number], WorkflowNode>>;
  target: ResolvedModelTarget;
  databaseAccess: "not_opened_or_queried";
}>;

export type RuntimePlanResult =
  Readonly<{ success: true; plan: RuntimePlan }> | Readonly<{ success: false; code: string }>;

export function compileRuntimePlan(input: unknown): RuntimePlanResult {
  const parsed = parseWorkflow(input);
  if (!parsed.success) return { success: false, code: "WORKFLOW_INVALID" };
  const workflow = parsed.data;
  const readiness = assessCanonicalWorkflowExecutionReadiness(workflow);
  if (!readiness.ready) return { success: false, code: "WORKFLOW_NOT_READY" };
  if (
    workflow.template.id !== "enterprise-rag-question-answer" ||
    workflow.template.version !== "1.0.0"
  )
    return { success: false, code: "TEMPLATE_UNSUPPORTED" };

  const entries = REQUIRED_TYPES.map((type) => {
    const matches = workflow.nodes.filter(
      (node) => node.type === type && node.implementationStatus === "executable",
    );
    return matches.length === 1 ? ([type, matches[0]] as const) : undefined;
  });
  if (entries.some((entry) => entry === undefined))
    return { success: false, code: "EXECUTABLE_NODE_CARDINALITY" };
  const nodes = Object.fromEntries(
    entries as ReadonlyArray<readonly [string, WorkflowNode]>,
  ) as Record<(typeof REQUIRED_TYPES)[number], WorkflowNode>;

  const runtimeEdges = workflow.edges.filter((edge) => edge.mode === "runtime");
  const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const validEdges = REQUIRED_EDGES.every(([source, target, contract]) =>
    runtimeEdges.some(
      (edge) =>
        nodeById.get(edge.sourceNodeId)?.type === source &&
        nodeById.get(edge.targetNodeId)?.type === target &&
        edge.dataContract === contract,
    ),
  );
  if (!validEdges) return { success: false, code: "RUNTIME_EDGE_MISSING" };
  if (nodes.gpt_agent.type !== "gpt_agent" || nodes.gpt_agent.configuration.model !== "gpt-5.6")
    return { success: false, code: "MODEL_TARGET_UNSUPPORTED" };

  return {
    success: true,
    plan: { workflow, nodes, target: OPENAI_GPT56_TARGET, databaseAccess: "not_opened_or_queried" },
  };
}
