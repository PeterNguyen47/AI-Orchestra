import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AssuranceRunBinding } from "@/domain/exports/architecture-assurance";
import { createCanonicalWorkflowSnapshot } from "@/domain/exports/workflow-export";
import { validateCanonicalWorkflowArchitecture } from "@/domain/validation/architecture-validator";
import { parseWorkflow } from "@/domain/workflow/workflow-parser";
import { createTrustedPreExecutionEvidence } from "@/server/runtime/run-evidence-recorder";
import { GovernedExportsPanel } from "./governed-exports-panel";

function workflow() {
  const parsed = parseWorkflow(
    JSON.parse(readFileSync("templates/enterprise-rag.v1.json", "utf8")),
  );
  if (!parsed.success) throw new Error("Canonical workflow fixture is invalid.");
  return structuredClone(parsed.data);
}

function binding(submitted = workflow()): AssuranceRunBinding {
  const snapshot = createCanonicalWorkflowSnapshot(submitted);
  if (!snapshot.success) throw new Error("Workflow snapshot failed.");
  return {
    evidence: createTrustedPreExecutionEvidence("LOCAL_EXECUTION_NOT_ENABLED", {
      runIdFactory: () => "run_00000000-0000-4000-8000-000000000012",
      clock: () => 0,
    }),
    submittedWorkflow: snapshot.workflow,
    submittedCanonicalWorkflowBytes: snapshot.canonicalBytes,
  };
}

function render(runBinding?: AssuranceRunBinding, current = workflow()) {
  return renderToStaticMarkup(
    createElement(GovernedExportsPanel, {
      workflow: current,
      architectureReport: validateCanonicalWorkflowArchitecture(current),
      ...(runBinding ? { runBinding } : {}),
    }),
  );
}

describe("GovernedExportsPanel", () => {
  it("renders enabled workflow JSON and disabled missing-run assurance controls", () => {
    const html = render();
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('<button type="button">Download workflow JSON</button>');
    expect(html).toContain(
      '<button type="button" disabled="">Download assurance Markdown</button>',
    );
    expect(html).toContain("Run a governed workflow before downloading architecture assurance.");
  });

  it("renders enabled current-run assurance controls for validated terminal evidence", () => {
    const current = workflow();
    const html = render(binding(current), current);
    expect(html).toContain('<button type="button">Download workflow JSON</button>');
    expect(html).toContain('<button type="button">Download assurance Markdown</button>');
    expect(html).not.toContain("Assurance unavailable:");
  });

  it("renders stale-run blocking text and disables assurance", () => {
    const submitted = workflow();
    const changed = structuredClone(submitted);
    changed.name = "Changed workflow state";
    const html = render(binding(submitted), changed);
    expect(html).toContain("The workflow differs from the submitted run snapshot.");
    expect(html).toContain(
      '<button type="button" disabled="">Download assurance Markdown</button>',
    );
  });

  it("renders semantic headings, two buttons, live status, and textual availability explanations", () => {
    const html = render();
    expect(html).toContain("<section");
    expect(html).toContain('aria-labelledby="governed-exports-title"');
    expect(html).toContain('<h3 id="governed-exports-title">Governed exports</h3>');
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Assurance unavailable:");
    expect(html).toContain(
      "Artifacts are generated in this browser session and are not persisted or logged.",
    );
  });
});
