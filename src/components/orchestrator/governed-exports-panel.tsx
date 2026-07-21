"use client";

import { useState } from "react";
import {
  generateArchitectureAssurance,
  getAssuranceAvailability,
  type AssuranceRunBinding,
} from "@/domain/exports/architecture-assurance";
import { inspectWorkflowExportSafety } from "@/domain/exports/export-safety";
import {
  createCanonicalWorkflowSnapshot,
  generateWorkflowExport,
} from "@/domain/exports/workflow-export";
import { exportFailure, type ExportFailure } from "@/domain/exports/export-contracts";
import type { ArchitectureValidationReport } from "@/domain/validation/architecture-validator";
import type { Workflow } from "@/domain/workflow/workflow-types";
import { downloadTextArtifact } from "./export-download";

type Availability = Readonly<{ success: true }> | ExportFailure;

function workflowAvailability(
  workflow: Workflow,
  report: ArchitectureValidationReport,
): Availability {
  if (!report.structureValid) return exportFailure("EXPORT_WORKFLOW_INVALID");
  const snapshot = createCanonicalWorkflowSnapshot(workflow);
  if (!snapshot.success) return snapshot;
  return inspectWorkflowExportSafety(snapshot.workflow);
}

export function GovernedExportsPanel({
  workflow,
  architectureReport,
  runBinding,
}: Readonly<{
  workflow: Workflow;
  architectureReport: ArchitectureValidationReport;
  runBinding?: AssuranceRunBinding | undefined;
}>) {
  const [pending, setPending] = useState<"workflow" | "assurance">();
  const [status, setStatus] = useState("Choose one validated client-session artifact.");
  const workflowState = workflowAvailability(workflow, architectureReport);
  const assuranceState = getAssuranceAvailability(workflow, runBinding);

  async function downloadWorkflow() {
    if (pending) return;
    setPending("workflow");
    try {
      const generated = await generateWorkflowExport(workflow, architectureReport);
      if (!generated.success) {
        setStatus(generated.explanation);
        return;
      }
      const downloaded = downloadTextArtifact(generated.artifact);
      setStatus(downloaded.success ? "Workflow JSON download initiated." : downloaded.explanation);
    } finally {
      setPending(undefined);
    }
  }

  async function downloadAssurance() {
    if (pending) return;
    setPending("assurance");
    try {
      const generated = await generateArchitectureAssurance(
        workflow,
        architectureReport,
        runBinding,
      );
      if (!generated.success) {
        setStatus(generated.explanation);
        return;
      }
      const downloaded = downloadTextArtifact(generated.artifact);
      setStatus(
        downloaded.success
          ? "Architecture-assurance Markdown download initiated."
          : downloaded.explanation,
      );
    } finally {
      setPending(undefined);
    }
  }

  return (
    <section
      className="governed-exports-panel"
      aria-labelledby="governed-exports-title"
      data-testid="governed-exports-panel"
    >
      <header>
        <p className="eyebrow">Deterministic client-session artifacts · AO-009</p>
        <h3 id="governed-exports-title">Governed exports</h3>
        <p>Artifacts are generated in this browser session and are not persisted or logged.</p>
      </header>
      <div className="governed-export-actions">
        <button
          type="button"
          onClick={downloadWorkflow}
          disabled={!workflowState.success || pending !== undefined}
        >
          {pending === "workflow" ? "Generating workflow JSON..." : "Download workflow JSON"}
        </button>
        <button
          type="button"
          onClick={downloadAssurance}
          disabled={!assuranceState.success || pending !== undefined}
        >
          {pending === "assurance"
            ? "Generating assurance Markdown..."
            : "Download assurance Markdown"}
        </button>
      </div>
      {!workflowState.success && (
        <p className="export-availability">
          Workflow JSON unavailable: {workflowState.explanation}
        </p>
      )}
      {!assuranceState.success && (
        <p className="export-availability">Assurance unavailable: {assuranceState.explanation}</p>
      )}
      <p className="export-status" aria-live="polite" aria-atomic="true">
        {status}
      </p>
    </section>
  );
}
