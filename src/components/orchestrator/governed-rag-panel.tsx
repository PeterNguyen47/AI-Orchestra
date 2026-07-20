"use client";

import { useState } from "react";
import { runGovernedRagAction } from "@/app/actions/governed-rag";
import type { GovernedRunResult } from "@/server/runtime/executor";
import type { Workflow } from "@/domain/workflow/workflow-types";

type SafeExecutionConfig = Readonly<{
  executionConfigured: boolean;
  timeoutMs: number;
  maximumOutputTokens: number;
  optionalOpenAiConfigured: boolean;
}>;
const safeMessage = (code: string) => {
  if (code === "OLLAMA_RUNTIME_UNAVAILABLE" || code === "OLLAMA_HTTP_FAILURE")
    return "Local Ollama is unavailable at the validated loopback endpoint.";
  if (code === "OLLAMA_MODEL_NOT_INSTALLED") return "The required qwen3:4b model is not installed.";
  if (code === "LOCAL_EXECUTION_NOT_ENABLED")
    return "Local execution is disabled. Enable it in the server environment.";
  if (code === "LOCAL_MODEL_TIMEOUT")
    return "The local model request reached its governed timeout.";
  return `Execution stopped safely (${code}).`;
};

export function GovernedRagPanel({
  workflow,
  executionReady,
  config,
}: Readonly<{ workflow: Workflow; executionReady: boolean; config: SafeExecutionConfig }>) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<GovernedRunResult>();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setResult(undefined);
    try {
      setResult(await runGovernedRagAction({ workflow, question }));
    } finally {
      setPending(false);
    }
  }
  const disabled = pending || !executionReady || !config.executionConfigured;
  return (
    <section className="governed-rag-panel" aria-labelledby="governed-rag-title">
      <div>
        <p className="eyebrow">Governed execution - AO-007</p>
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
          <>
            <h3>Completed</h3>
            <p className="answer-markdown">{result.answerMarkdown}</p>
            <h4>Validated citations</h4>
            <ul>
              {result.citations.map((citation) => (
                <li key={citation.id}>
                  <code>{citation.id}</code> - {citation.title}
                </li>
              ))}
            </ul>
            <p>
              {result.usage.inputTokens} input + {result.usage.outputTokens} output ={" "}
              {result.usage.totalTokens} tokens - {result.durationMs}ms
            </p>
            <p>External API cost $0.00. Local compute cost not measured.</p>
            <p>
              Model identity: {result.model}
              {result.modelDigest ? ` (${result.modelDigest})` : ""}
            </p>
            <p>Guardrail passed - citation coverage passed - database not opened or queried.</p>
          </>
        )}
        {result && result.status !== "completed" && <p role="alert">{safeMessage(result.code)}</p>}
      </div>
    </section>
  );
}
