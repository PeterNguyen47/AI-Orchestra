import { parseWorkflow, type WorkflowParseIssue } from "./workflow-parser";
import { CURRENT_WORKFLOW_SCHEMA_VERSION } from "./workflow-schema";
import type { Workflow } from "./workflow-types";

type MigrationFailureKind =
  | "missing_version"
  | "invalid_version"
  | "unsupported_older_version"
  | "unsupported_future_version"
  | "unsupported_version"
  | "invalid_current_workflow";

export type WorkflowMigrationResult =
  | Readonly<{
      success: true;
      kind: "current";
      sourceVersion: typeof CURRENT_WORKFLOW_SCHEMA_VERSION;
      currentVersion: typeof CURRENT_WORKFLOW_SCHEMA_VERSION;
      workflow: Workflow;
    }>
  | Readonly<{
      success: false;
      kind: MigrationFailureKind;
      sourceVersion?: string;
      currentVersion: typeof CURRENT_WORKFLOW_SCHEMA_VERSION;
      message: string;
      issues?: ReadonlyArray<WorkflowParseIssue>;
    }>;

type SemanticVersionParts = Readonly<{
  core: readonly [major: number, minor: number, patch: number];
  prerelease: ReadonlyArray<string>;
}>;

function readSemanticVersion(version: string): SemanticVersionParts | undefined {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
      version,
    );

  if (match === null) {
    return undefined;
  }

  const prerelease = match[4]?.split(".") ?? [];
  if (prerelease.some((identifier) => /^\d+$/.test(identifier) && /^0\d+/.test(identifier))) {
    return undefined;
  }

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease,
  };
}

function compareWithCurrentVersion(source: SemanticVersionParts): number {
  const current = readSemanticVersion(CURRENT_WORKFLOW_SCHEMA_VERSION)!;

  for (let index = 0; index < source.core.length; index += 1) {
    const leftPart = source.core[index]!;
    const rightPart = current.core[index]!;

    if (leftPart !== rightPart) {
      return leftPart < rightPart ? -1 : 1;
    }
  }

  return source.prerelease.length > 0 ? -1 : 0;
}

export function migrateWorkflowToCurrent(input: unknown): WorkflowMigrationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      kind: "missing_version",
      currentVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      message: "Workflow input must be an object with a schemaVersion property.",
    };
  }

  const record = input as Record<string, unknown>;

  if (!Object.hasOwn(record, "schemaVersion")) {
    return {
      success: false,
      kind: "missing_version",
      currentVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      message: "Workflow schemaVersion is required before migration can be evaluated.",
    };
  }

  if (typeof record.schemaVersion !== "string") {
    return {
      success: false,
      kind: "invalid_version",
      currentVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      message: "Workflow schemaVersion must be a semantic version string.",
    };
  }

  const sourceVersion = readSemanticVersion(record.schemaVersion);

  if (sourceVersion === undefined) {
    return {
      success: false,
      kind: "invalid_version",
      sourceVersion: record.schemaVersion,
      currentVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      message: "Workflow schemaVersion must be a valid semantic version.",
    };
  }

  const comparison = compareWithCurrentVersion(sourceVersion);

  if (comparison < 0) {
    return {
      success: false,
      kind: "unsupported_older_version",
      sourceVersion: record.schemaVersion,
      currentVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      message: `Workflow version ${record.schemaVersion} has no supported migration path.`,
    };
  }

  if (comparison > 0) {
    return {
      success: false,
      kind: "unsupported_future_version",
      sourceVersion: record.schemaVersion,
      currentVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      message: `Workflow version ${record.schemaVersion} is newer than this application. Upgrade AI Orchestra before opening it.`,
    };
  }

  if (record.schemaVersion !== CURRENT_WORKFLOW_SCHEMA_VERSION) {
    return {
      success: false,
      kind: "unsupported_version",
      sourceVersion: record.schemaVersion,
      currentVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      message: `Workflow version ${record.schemaVersion} is not the exact supported contract version ${CURRENT_WORKFLOW_SCHEMA_VERSION}.`,
    };
  }

  const parsed = parseWorkflow(input);

  if (!parsed.success) {
    return {
      success: false,
      kind: "invalid_current_workflow",
      sourceVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      currentVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
      message: "Current-version workflow failed strict structural validation.",
      issues: parsed.issues,
    };
  }

  return {
    success: true,
    kind: "current",
    sourceVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
    currentVersion: CURRENT_WORKFLOW_SCHEMA_VERSION,
    workflow: parsed.data,
  };
}
