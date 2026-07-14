import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  generateWorkflowJsonSchema,
  generateWorkflowJsonSchemaText,
  WORKFLOW_JSON_SCHEMA_DIALECT,
} from "./workflow-json-schema";
import {
  CURRENT_WORKFLOW_SCHEMA_VERSION,
  SUPPORTED_NODE_TYPES,
  WORKFLOW_SCHEMA_ID,
} from "./workflow-schema";

const committedSchemaPath = resolve(process.cwd(), "schemas", "workflow.v1.schema.json");

function visitJson(value: unknown, visitor: (record: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => visitJson(entry, visitor));
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  visitor(record);
  Object.values(record).forEach((entry) => visitJson(entry, visitor));
}

describe("workflow JSON Schema generation", () => {
  it("generates deterministic Draft 2020-12 metadata", () => {
    const first = generateWorkflowJsonSchemaText();
    const second = generateWorkflowJsonSchemaText();
    const schema = generateWorkflowJsonSchema();

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(schema.$schema).toBe(WORKFLOW_JSON_SCHEMA_DIALECT);
    expect(schema.$id).toBe(WORKFLOW_SCHEMA_ID);
    expect(schema["x-ai-orchestra-workflow-schema-version"]).toBe(CURRENT_WORKFLOW_SCHEMA_VERSION);
  });

  it("matches the committed JSON Schema byte for byte", () => {
    expect(readFileSync(committedSchemaPath, "utf8")).toBe(generateWorkflowJsonSchemaText());
  });

  it("keeps every generated object schema closed", () => {
    const objectSchemas: Array<Record<string, unknown>> = [];

    visitJson(generateWorkflowJsonSchema(), (record) => {
      if (record.type === "object") {
        objectSchemas.push(record);
      }
    });

    expect(objectSchemas.length).toBeGreaterThan(20);
    expect(objectSchemas.every((schema) => schema.additionalProperties === false)).toBe(true);
  });

  it("contains one closed branch for every supported node type", () => {
    const nodeTypeConstants = new Set<string>();

    visitJson(generateWorkflowJsonSchema(), (record) => {
      if (
        typeof record.const === "string" &&
        SUPPORTED_NODE_TYPES.includes(record.const as (typeof SUPPORTED_NODE_TYPES)[number])
      ) {
        nodeTypeConstants.add(record.const);
      }
    });

    expect(nodeTypeConstants).toEqual(new Set(SUPPORTED_NODE_TYPES));
  });

  it("requires the exact closed set of evaluation metrics", () => {
    const strictMetricObjects: Array<Record<string, unknown>> = [];

    visitJson(generateWorkflowJsonSchema(), (record) => {
      const properties = record.properties as Record<string, unknown> | undefined;
      if (
        record.type === "object" &&
        properties !== undefined &&
        Object.hasOwn(properties, "citation_coverage") &&
        Object.hasOwn(properties, "groundedness") &&
        Object.hasOwn(properties, "relevance")
      ) {
        strictMetricObjects.push(record);
      }
    });

    expect(strictMetricObjects.length).toBeGreaterThanOrEqual(2);
    expect(
      strictMetricObjects.every(
        (schema) =>
          schema.additionalProperties === false &&
          Array.isArray(schema.required) &&
          schema.required.length === 3,
      ),
    ).toBe(true);
  });
});
