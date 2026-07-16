"use client";

import { useState } from "react";
import { ValidationFinding } from "./validation-finding";
import type { ArchitectureValidationReport } from "@/domain/validation/architecture-validator";
import type { Workflow } from "@/domain/workflow/workflow-types";

type Filter = "all" | "error" | "warning";

export function ArchitectureValidationPanel({
  report,
  workflow,
  onFocusSubject,
}: Readonly<{
  report: ArchitectureValidationReport;
  workflow: Workflow;
  onFocusSubject: (subject: Readonly<{ kind: "node" | "edge"; id: string }>) => void;
}>) {
  const [filter, setFilter] = useState<Filter>("all");
  const findings = report.findings.filter(
    (finding) => filter === "all" || finding.severity === filter,
  );
  const labelFor = (finding: ArchitectureValidationReport["findings"][number]) => {
    if (!finding.subject.id) return "Workflow";
    if (finding.subject.kind === "node") {
      const node = workflow.nodes.find((candidate) => candidate.id === finding.subject.id);
      return `${node?.label ?? "Node"} (${finding.subject.id})`;
    }
    const edge = workflow.edges.find((candidate) => candidate.id === finding.subject.id);
    return `${edge?.label ?? "Edge"} (${finding.subject.id})`;
  };
  return (
    <section className="architecture-validation-panel" aria-labelledby="validation-title">
      <div className="section-heading compact">
        <p className="panel-kicker">Unified architecture validation</p>
        <h2 id="validation-title">Detailed findings</h2>
      </div>
      <div className="validation-filters" role="group" aria-label="Filter validation findings">
        {(["all", "error", "warning"] as const).map((value) => (
          <button
            className="secondary-button"
            type="button"
            aria-pressed={filter === value}
            key={value}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "All" : value === "error" ? "Errors" : "Warnings"}
          </button>
        ))}
      </div>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        Validation updated: {report.errorCount} errors and {report.warningCount} warnings.{" "}
        {report.executionReady ? "Ready for future execution." : "Execution readiness blocked."}
      </p>
      {findings.length ? (
        <ul className="validation-findings">
          {findings.map((finding, index) => (
            <ValidationFinding
              key={`${finding.code}-${finding.path}-${index}`}
              finding={finding}
              subjectLabel={labelFor(finding)}
              onFocus={
                finding.subject.id && finding.subject.kind !== "workflow"
                  ? () =>
                      onFocusSubject({
                        kind: finding.subject.kind as "node" | "edge",
                        id: finding.subject.id!,
                      })
                  : undefined
              }
            />
          ))}
        </ul>
      ) : (
        <p>No findings match this filter.</p>
      )}
    </section>
  );
}
