import { WorkflowSchema } from "./workflow-schema";
import type { Workflow } from "./workflow-types";

export type WorkflowParsePath = ReadonlyArray<string | number>;

export type WorkflowParseIssue = Readonly<{
  code: string;
  path: WorkflowParsePath;
  message: string;
}>;

export type WorkflowParseResult =
  | Readonly<{ success: true; data: Workflow }>
  | Readonly<{ success: false; issues: ReadonlyArray<WorkflowParseIssue> }>;

function normalizePath(path: ReadonlyArray<PropertyKey>): WorkflowParsePath {
  return path.map((segment) => (typeof segment === "number" ? segment : String(segment)));
}

export function parseWorkflow(input: unknown): WorkflowParseResult {
  const result = WorkflowSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      code: issue.code,
      path: normalizePath(issue.path),
      message: issue.message,
    })),
  };
}

export function parseWorkflowJson(json: string): WorkflowParseResult {
  let input: unknown;

  try {
    input = JSON.parse(json) as unknown;
  } catch {
    return {
      success: false,
      issues: [{ code: "invalid_json", path: [], message: "Workflow input is not valid JSON." }],
    };
  }

  return parseWorkflow(input);
}

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonKeys(entry));
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => {
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });

    return Object.fromEntries(keys.map((key) => [key, sortJsonKeys(record[key])]));
  }

  return value;
}

export class WorkflowSerializationError extends Error {
  readonly issues: ReadonlyArray<WorkflowParseIssue>;

  constructor(issues: ReadonlyArray<WorkflowParseIssue>) {
    super("Cannot serialize an invalid workflow.");
    this.name = "WorkflowSerializationError";
    this.issues = issues;
  }
}

export function serializeWorkflow(input: unknown): string {
  const parsed = parseWorkflow(input);

  if (!parsed.success) {
    throw new WorkflowSerializationError(parsed.issues);
  }

  return `${JSON.stringify(sortJsonKeys(parsed.data), null, 2)}\n`;
}
