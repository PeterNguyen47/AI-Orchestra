import "server-only";

export const MAXIMUM_ACTION_QUESTION_CHARACTERS = 8_000 as const;
export const MAXIMUM_SERIALIZED_WORKFLOW_BYTES = 1_000_000 as const;

export type GovernedRequestBoundaryResult =
  | Readonly<{ success: true; workflow: unknown; question: string }>
  | Readonly<{ success: false; code: "REQUEST_INVALID" }>;

export function validateGovernedRequestBoundary(input: unknown): GovernedRequestBoundaryResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, code: "REQUEST_INVALID" };
  }
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== "question" ||
    keys[1] !== "workflow" ||
    typeof record.question !== "string" ||
    record.question.length > MAXIMUM_ACTION_QUESTION_CHARACTERS
  ) {
    return { success: false, code: "REQUEST_INVALID" };
  }

  try {
    const serialized = JSON.stringify(record.workflow);
    if (
      serialized === undefined ||
      new TextEncoder().encode(serialized).byteLength > MAXIMUM_SERIALIZED_WORKFLOW_BYTES
    ) {
      return { success: false, code: "REQUEST_INVALID" };
    }
  } catch {
    return { success: false, code: "REQUEST_INVALID" };
  }

  return { success: true, workflow: record.workflow, question: record.question };
}
