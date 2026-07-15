import "server-only";
import enterpriseRagTemplate from "../../../templates/enterprise-rag.v1.json";
import { parseWorkflow } from "@/domain/workflow/workflow-parser";
import { validateWorkflowSemantics } from "@/domain/workflow/workflow-validator";
import type { Workflow } from "@/domain/workflow/workflow-types";

export type EnterpriseRagLoadResult =
  | Readonly<{ success: true; workflow: Workflow; findingCount: 0 }>
  | Readonly<{ success: false; message: string }>;

export function loadEnterpriseRagWorkflow(): EnterpriseRagLoadResult {
  const parsed = parseWorkflow(enterpriseRagTemplate);
  if (!parsed.success) {
    return { success: false, message: "The committed Enterprise RAG blueprint is unavailable." };
  }
  const validation = validateWorkflowSemantics(parsed.data);
  if (!validation.valid) {
    return {
      success: false,
      message: "The committed Enterprise RAG blueprint did not pass validation.",
    };
  }
  return { success: true, workflow: parsed.data, findingCount: 0 };
}
