import { EnvironmentVariableNameSchema } from "@/domain/workflow/workflow-schema";
import { containsSensitiveText } from "@/domain/security/sensitive-data";
import {
  ARCHITECTURE_ASSURANCE_ARTIFACT_TYPE,
  ARCHITECTURE_ASSURANCE_SCHEMA_VERSION,
  exportFailure,
  safeArtifactFilenameSchema,
  WORKFLOW_EXPORT_ARTIFACT_TYPE,
  WORKFLOW_EXPORT_SCHEMA_VERSION,
  type ExportFailure,
} from "./export-contracts";

const prohibitedControlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
type SafetyPath = ReadonlyArray<string | number>;

function isEnvironmentVariableReference(path: SafetyPath, value: string): boolean {
  const current = path.at(-1);
  const parent = path.at(-2);
  return (
    EnvironmentVariableNameSchema.safeParse(value).success &&
    (current === "environmentVariableName" ||
      (typeof current === "number" && parent === "requiredEnvironmentVariables"))
  );
}

function containsUnsafeValue(value: unknown, path: SafetyPath): boolean {
  if (typeof value === "string") {
    if (isEnvironmentVariableReference(path, value)) return false;
    return containsSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.some((entry, index) => containsUnsafeValue(entry, [...path, index]));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(([key, entry]) => containsUnsafeValue(entry, [...path, key]));
  }
  return false;
}

export type WorkflowSafetyResult = Readonly<{ success: true }> | ExportFailure;

export function inspectWorkflowExportSafety(workflow: unknown): WorkflowSafetyResult {
  return containsUnsafeValue(workflow, [])
    ? exportFailure("EXPORT_WORKFLOW_UNSAFE")
    : { success: true };
}

export function normalizeMarkdownText(value: string, maximumLength = 320): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

export function escapeMarkdownText(value: string, maximumLength = 320): string {
  return normalizeMarkdownText(value, maximumLength).replace(
    /[\\`*_{}\[\]()<>#+.!|>~-]/g,
    (character) => `\\${character}`,
  );
}

export type ArtifactFilenameResult = Readonly<{ success: true; filename: string }> | ExportFailure;

export function createArtifactFilename(
  workflowId: string,
  artifactType: typeof WORKFLOW_EXPORT_ARTIFACT_TYPE | typeof ARCHITECTURE_ASSURANCE_ARTIFACT_TYPE,
): ArtifactFilenameResult {
  if (
    workflowId.includes("/") ||
    workflowId.includes("\\") ||
    workflowId.includes("..") ||
    /^[A-Za-z]:/.test(workflowId) ||
    prohibitedControlCharacters.test(workflowId) ||
    /[. ]$/.test(workflowId)
  ) {
    return exportFailure("EXPORT_FILENAME_UNSAFE");
  }

  const filename =
    artifactType === WORKFLOW_EXPORT_ARTIFACT_TYPE
      ? `ai-orchestra-${workflowId}.workflow-export.v${WORKFLOW_EXPORT_SCHEMA_VERSION}.json`
      : `ai-orchestra-${workflowId}.architecture-assurance.v${ARCHITECTURE_ASSURANCE_SCHEMA_VERSION}.md`;
  return safeArtifactFilenameSchema.safeParse(filename).success
    ? { success: true, filename }
    : exportFailure("EXPORT_FILENAME_UNSAFE");
}
