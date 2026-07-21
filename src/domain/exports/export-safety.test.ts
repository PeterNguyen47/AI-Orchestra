import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWorkflow } from "@/domain/workflow/workflow-parser";
import {
  createArtifactFilename,
  escapeMarkdownText,
  inspectWorkflowExportSafety,
} from "./export-safety";
import { WORKFLOW_EXPORT_ARTIFACT_TYPE } from "./export-contracts";

function workflow() {
  const parsed = parseWorkflow(
    JSON.parse(readFileSync("templates/enterprise-rag.v1.json", "utf8")),
  );
  if (!parsed.success) throw new Error("Canonical workflow fixture is invalid.");
  return structuredClone(parsed.data);
}

describe("export safety", () => {
  it("accepts the canonical workflow and schema-declared environment references", () => {
    const safe = workflow();
    safe.deployment.requiredEnvironmentVariables.push("OPENAI_API_KEY");
    expect(inspectWorkflowExportSafety(safe)).toEqual({ success: true });
  });

  it("rejects credential and bearer values without exposing matched content", () => {
    for (const value of [
      "password=not-a-real-value",
      "Bearer abcdefgh",
      "-----BEGIN " + "PRIVATE KEY-----",
      "-----BEGIN ENCRYPTED " + "PRIVATE KEY-----",
    ]) {
      const unsafe = workflow();
      unsafe.description = value;
      const result = inspectWorkflowExportSafety(unsafe);
      expect(result).toEqual({
        success: false,
        code: "EXPORT_WORKFLOW_UNSAFE",
        explanation: "The workflow contains content that is unsafe to export.",
      });
      expect(JSON.stringify(result)).not.toContain(value);
    }
  });

  it("rejects database URLs, absolute paths, and session material", () => {
    for (const value of [
      "postgresql://example.invalid/database",
      "Z:\\SyntheticFixture\\workflow.json",
      "session=synthetic-session",
    ]) {
      const unsafe = workflow();
      unsafe.name = value;
      expect(inspectWorkflowExportSafety(unsafe)).toMatchObject({
        success: false,
        code: "EXPORT_WORKFLOW_UNSAFE",
      });
    }
  });

  it("rejects prohibited control characters", () => {
    const unsafe = workflow();
    unsafe.description = `safe\u0001unsafe`;
    expect(inspectWorkflowExportSafety(unsafe)).toMatchObject({
      success: false,
      code: "EXPORT_WORKFLOW_UNSAFE",
    });
  });

  it("normalizes and escapes links, images, HTML, headings, tables, and code", () => {
    const source = "## [link](url) ![image](url) <b>x</b> | table | ```code``` `inline`";
    const escaped = escapeMarkdownText(source);
    expect(escaped).not.toContain("##");
    expect(escaped).not.toContain("[link](url)");
    expect(escaped).not.toContain("![image]");
    expect(escaped).not.toContain("<b>");
    expect(escaped).not.toContain("```");
    expect(escaped).toContain("\\| table \\|");
    expect(escaped).not.toContain("\n");
  });

  it("creates stable bounded filenames and blocks traversal while safely prefixing device names", () => {
    const stable = createArtifactFilename("con", WORKFLOW_EXPORT_ARTIFACT_TYPE);
    expect(stable).toEqual({
      success: true,
      filename: "ai-orchestra-con.workflow-export.v1.0.0.json",
    });
    if (stable.success) expect(stable.filename.length).toBeLessThanOrEqual(180);
    expect(createArtifactFilename("../con", WORKFLOW_EXPORT_ARTIFACT_TYPE)).toMatchObject({
      success: false,
      code: "EXPORT_FILENAME_UNSAFE",
    });
  });

  it("produces identical safety and Markdown results across repeated calls", () => {
    const safe = workflow();
    expect(inspectWorkflowExportSafety(safe)).toEqual(inspectWorkflowExportSafety(safe));
    const markdown = "# repeat | `value`";
    expect(escapeMarkdownText(markdown)).toBe(escapeMarkdownText(markdown));
  });
});
