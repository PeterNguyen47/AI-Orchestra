import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CURRENT_WORKFLOW_SCHEMA_VERSION } from "./workflow-schema";
import { migrateWorkflowToCurrent } from "./workflow-migrations";

const templatePath = resolve(process.cwd(), "templates", "enterprise-rag.v1.json");

function workflowObject(): Record<string, unknown> {
  return JSON.parse(readFileSync(templatePath, "utf8")) as Record<string, unknown>;
}

describe("workflow migrations", () => {
  it("validates and returns the canonical current representation", () => {
    const input = workflowObject();
    const result = migrateWorkflowToCurrent(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.kind).toBe("current");
      expect(result.sourceVersion).toBe(CURRENT_WORKFLOW_SCHEMA_VERSION);
      expect(result.currentVersion).toBe(CURRENT_WORKFLOW_SCHEMA_VERSION);
      expect(result.workflow).toEqual(input);
    }
  });

  it("rejects a missing version explicitly", () => {
    const input = workflowObject();
    delete input.schemaVersion;

    expect(migrateWorkflowToCurrent(input)).toEqual(
      expect.objectContaining({ success: false, kind: "missing_version" }),
    );
    expect(migrateWorkflowToCurrent(null)).toEqual(
      expect.objectContaining({ success: false, kind: "missing_version" }),
    );
    expect(migrateWorkflowToCurrent([])).toEqual(
      expect.objectContaining({ success: false, kind: "missing_version" }),
    );
  });

  it.each([42, "v1", "1.0", "1.0.0-01"])("rejects invalid version %j", (version) => {
    const input = workflowObject();
    input.schemaVersion = version;

    expect(migrateWorkflowToCurrent(input)).toEqual(
      expect.objectContaining({ success: false, kind: "invalid_version" }),
    );
  });

  it.each(["0.9.0", "1.0.0-alpha.1"])(
    "rejects unsupported older version %s without inventing a migration",
    (version) => {
      const input = workflowObject();
      input.schemaVersion = version;

      expect(migrateWorkflowToCurrent(input)).toEqual(
        expect.objectContaining({
          success: false,
          kind: "unsupported_older_version",
          sourceVersion: version,
        }),
      );
    },
  );

  it.each(["1.0.1", "1.1.0", "2.0.0-rc.1"])(
    "rejects unsupported future version %s and requires an application upgrade",
    (version) => {
      const input = workflowObject();
      input.schemaVersion = version;

      const result = migrateWorkflowToCurrent(input);
      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          kind: "unsupported_future_version",
          sourceVersion: version,
        }),
      );
      if (!result.success) {
        expect(result.message).toContain("Upgrade AI Orchestra");
      }
    },
  );

  it("rejects an equal-precedence but noncanonical build version", () => {
    const input = workflowObject();
    input.schemaVersion = "1.0.0+local";

    expect(migrateWorkflowToCurrent(input)).toEqual(
      expect.objectContaining({ success: false, kind: "unsupported_version" }),
    );
  });

  it("does not discard unknown fields from a current-version workflow", () => {
    const input = workflowObject();
    input.unexpected = "must fail closed";

    const result = migrateWorkflowToCurrent(input);

    expect(result).toEqual(
      expect.objectContaining({ success: false, kind: "invalid_current_workflow" }),
    );
    if (!result.success && result.kind === "invalid_current_workflow") {
      expect(result.issues?.length).toBeGreaterThan(0);
    }
  });
});
