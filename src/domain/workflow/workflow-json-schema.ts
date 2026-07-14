import { z } from "zod";

import {
  CURRENT_WORKFLOW_SCHEMA_VERSION,
  WORKFLOW_SCHEMA_ID,
  WorkflowSchema,
} from "./workflow-schema";

export const WORKFLOW_JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema" as const;
export const WORKFLOW_JSON_SCHEMA_TITLE = "AI Orchestra Workflow Contract v1" as const;
export const WORKFLOW_JSON_SCHEMA_DESCRIPTION =
  "Strict structural contract for AI Orchestra workflow JSON version 1.0.0. Cross-node semantic graph rules are enforced separately by the workflow validator." as const;

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonKeys(entry));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
        .map((key) => [key, sortJsonKeys((value as Record<string, unknown>)[key])]),
    );
  }

  return value;
}

export function generateWorkflowJsonSchema(): Record<string, unknown> {
  const generatedSchema = z.toJSONSchema(WorkflowSchema, {
    target: "draft-2020-12",
    unrepresentable: "throw",
    cycles: "throw",
    reused: "ref",
  });

  return sortJsonKeys({
    ...generatedSchema,
    $schema: WORKFLOW_JSON_SCHEMA_DIALECT,
    $id: WORKFLOW_SCHEMA_ID,
    title: WORKFLOW_JSON_SCHEMA_TITLE,
    description: WORKFLOW_JSON_SCHEMA_DESCRIPTION,
    "x-ai-orchestra-workflow-schema-version": CURRENT_WORKFLOW_SCHEMA_VERSION,
  }) as Record<string, unknown>;
}

export function generateWorkflowJsonSchemaText(): string {
  return `${JSON.stringify(generateWorkflowJsonSchema(), null, 2)}\n`;
}
