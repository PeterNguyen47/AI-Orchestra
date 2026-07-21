"use client";

import { useState } from "react";
import { runGovernedRagAction } from "@/app/actions/governed-rag";
import type { GovernedRunResult } from "@/server/runtime/executor";
import type { Workflow } from "@/domain/workflow/workflow-types";
import { GovernedRunEvidence } from "./governed-run-evidence";

import { runEvidenceSchema } from "@/domain/runtime/run-evidence";
import type { ArchitectureValidationReport } from "@/domain/validation/architecture-validator";
import { createCanonicalWorkflowSnapshot } from "@/domain/exports/workflow-export";
import type { AssuranceRunBinding } from "@/domain/exports/architecture-assurance";
import { GovernedExportsPanel } from "./governed-exports-panel";

type SafeExecutionConfig = Readonly<{
  executionConfigured: boolean;
  timeoutMs: number;
  maximumOutputTokens: number;
  optionalOpenAiConfigured: boolean;
}>;
export function GovernedRagPanel({
  workflow,
  architectureReport,
  executionReady,
  config,
}: Readonly<{
  workflow: Workflow;
  architectureReport: ArchitectureValidationReport;
  executionReady: boolean;
  config: SafeExecutionConfig;
}>) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<GovernedRunResult>();
  const [runBinding, setRunBinding] = useState<AssuranceRunBinding>();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const submitted = createCanonicalWorkflowSnapshot(workflow);
    if (!submitted.success) return;
    setPending(true);
    setResult(undefined);
    try {
      const nextResult = await runGovernedRagAction({ workflow: submitted.workflow, question });
      setResult(nextResult);
      const evidence = runEvidenceSchema.safeParse(nextResult.evidence);
      if (evidence.success) {
        setRunBinding({
          evidence: evidence.data,
          submittedWorkflow: submitted.workflow,
          submittedCanonicalWorkflowBytes: submitted.canonicalBytes,
        });
      }
    } finally {
      setPending(false);
    }
  }
  const disabled = pending || !executionReady || !config.executionConfigured;
  return (
    <section className="governed-rag-panel" aria-labelledby="governed-rag-title">
      <div>
        <p className="eyebrow">Governed execution evidence · AO-008</p>
        <h2 id="governed-rag-title">Governed Local Open-Model Execution</h2>
        <p>
          Provider: <strong>Local Ollama</strong> - Model: <strong>Qwen3 4B</strong>
        </p>
        <p>
          Deployment boundary: <strong>This computer</strong> - License:{" "}
          <strong>Apache-2.0 open-weight</strong>
        </p>
        <p>
          No cloud API key is required. Tools, handoffs, thinking output, persistence, and database
          access are disabled.
        </p>
        <dl className="execution-facts">
          <div>
            <dt>Timeout</dt>
            <dd>{config.timeoutMs / 1_000}s</dd>
          </div>
          <div>
            <dt>Output limit</dt>
            <dd>{config.maximumOutputTokens} tokens</dd>
          </div>
          <div>
            <dt>External API cost</dt>
            <dd>$0.00</dd>
          </div>
        </dl>
        <p>Local hardware and electricity costs are not estimated.</p>
        <p>
          Optional hosted GPT-5.6 adapter:{" "}
          {config.optionalOpenAiConfigured
            ? "configured but disabled for this workflow"
            : "disabled and not configured"}
          .
        </p>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="rag-question">Question</label>
        <textarea
          id="rag-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={4_000}
          rows={4}
          required
        />
        {!executionReady && <p role="status">Execution is blocked by architecture readiness.</p>}
        {!config.executionConfigured && (
          <p role="status">
            Local execution is disabled. Set AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED=true on the server
            after Ollama and qwen3:4b are ready.
          </p>
        )}
        <button type="submit" disabled={disabled}>
          {pending ? "Running..." : "Run governed local RAG"}
        </button>
      </form>
      <div className="execution-result" aria-live="polite" aria-busy={pending}>
        {result?.status === "completed" && (
          <section
            className="approved-run-result"
            aria-labelledby="approved-run-result-title"
            data-testid="approved-run-result"
          >
            <h3 id="approved-run-result-title">Approved result</h3>
            <h4>Answer</h4>
            <p className="answer-markdown">{result.answerMarkdown}</p>
            <h4>Validated citations</h4>
            <ul>
              {result.citations.map((citation) => (
                <li key={citation.id}>
                  <code>{citation.id}</code> - {citation.title}
                </li>
              ))}
            </ul>
          </section>
        )}
        {result && <GovernedRunEvidence evidence={result.evidence} />}
      </div>
      <GovernedExportsPanel
        workflow={workflow}
        architectureReport={architectureReport}
        runBinding={runBinding}
      />
    </section>
  );
}
