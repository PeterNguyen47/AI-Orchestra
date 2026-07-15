import enterpriseRagTemplate from "../../../templates/enterprise-rag.v1.json";
import { parseWorkflow, validateWorkflowSemantics } from "../../domain/workflow";

export type DashboardSummary = Readonly<{
  schemaVersion: string;
  nodeCount: number;
  executableNodeCount: number;
  simulatedNodeCount: number;
  runtimeEdgeCount: number;
  advisoryEdgeCount: number;
  semanticValidationStatus: "Valid" | "Invalid";
}>;

export function getEnterpriseRagDashboardSummary(): DashboardSummary {
  const parsed = parseWorkflow(enterpriseRagTemplate);
  if (!parsed.success) {
    throw new Error("The canonical Enterprise RAG template failed structural validation.");
  }

  const semantic = validateWorkflowSemantics(parsed.data);
  return {
    schemaVersion: parsed.data.schemaVersion,
    nodeCount: parsed.data.nodes.length,
    executableNodeCount: parsed.data.nodes.filter(
      (node) => node.implementationStatus === "executable",
    ).length,
    simulatedNodeCount: parsed.data.nodes.filter(
      (node) => node.implementationStatus === "simulated",
    ).length,
    runtimeEdgeCount: parsed.data.edges.filter((edge) => edge.mode === "runtime").length,
    advisoryEdgeCount: parsed.data.edges.filter((edge) => edge.mode === "advisory").length,
    semanticValidationStatus: semantic.valid ? "Valid" : "Invalid",
  };
}
