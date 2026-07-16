"use client";

import { useState } from "react";
import { runGovernedRagAction } from "@/app/actions/governed-rag";
import type { GovernedRunResult } from "@/server/runtime/executor";
import type { Workflow } from "@/domain/workflow/workflow-types";

type SafeExecutionConfig = Readonly<{
  executionConfigured: boolean;
  timeoutMs: number;
  maximumOutputTokens: number;
  maximumRunCostUsd: number;
}>;

export function GovernedRagPanel({
  workflow,
  executionReady,
  config,
}: Readonly<{ workflow: Workflow; executionReady: boolean; config: SafeExecutionConfig }>) {
  const [question, setQuestion] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<GovernedRunResult>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !acknowledged) return;
    setPending(true);
    setResult(undefined);
    try {
      setResult(await runGovernedRagAction({ workflow, question, creditAcknowledged: true }));
    } finally {
      setPending(false);
    }
  }

  const disabled = pending || !executionReady || !config.executionConfigured || !acknowledged;
  return (
    <section className="governed-rag-panel" aria-labelledby="governed-rag-title">
      <div>
        <p className="eyebrow">Governed execution · AO-007</p>
        <h2 id="governed-rag-title">Enterprise RAG execution</h2>
        <p>
          Provider: <strong>OpenAI Responses</strong> · Model: <strong>GPT-5.6</strong>, the current
          reference implementation. Governed open-model adapters are a future direction.
        </p>
        <p>Tools and handoffs are disabled. The simulated database is never opened or queried.</p>
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
            <dt>Estimated cost cap</dt>
            <dd>${config.maximumRunCostUsd.toFixed(2)}</dd>
          </div>
        </dl>
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
        <label className="execution-acknowledgment">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          I understand that a live run may consume API credits.
        </label>
        {!executionReady && <p role="status">Execution is blocked by architecture readiness.</p>}
        {!config.executionConfigured && <p role="status">Live execution is not configured.</p>}
        <button type="submit" disabled={disabled}>
          {pending ? "Running…" : "Run governed RAG"}
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
                  <code>{citation.id}</code> — {citation.title}
                </li>
              ))}
            </ul>
            <p>
              {result.usage.totalTokens} tokens · estimated ${result.estimatedCostUsd.toFixed(4)} ·{" "}
              {result.durationMs}ms
            </p>
            <p>Guardrail passed · citation coverage passed · database not opened or queried.</p>
          </>
        )}
        {result && result.status !== "completed" && (
          <p role="alert">
            {result.status.replace("-", " ")}: {result.code}
          </p>
        )}
      </div>
    </section>
  );
}
