import { OrchestratorShell } from "@/components/orchestrator/orchestrator-shell";
import { loadEnterpriseRagWorkflow } from "@/server/orchestrator/load-enterprise-rag";
import { getRuntimeConfig } from "@/server/runtime-config";

export default function OrchestratorPage() {
  const result = loadEnterpriseRagWorkflow();
  if (!result.success) {
    return (
      <main className="orchestrator-shell" id="main-content">
        <section className="orchestrator-unavailable" role="alert">
          <p className="eyebrow">Orchestrator unavailable</p>
          <h1>Canonical blueprint could not be loaded.</h1>
          <p>{result.message}</p>
          <a href="/dashboard">Return to dashboard</a>
        </section>
      </main>
    );
  }
  const config = getRuntimeConfig();
  return (
    <OrchestratorShell
      initialWorkflow={result.workflow}
      executionConfig={{
        executionConfigured: config.executionConfigured,
        timeoutMs: config.localTimeoutMs,
        maximumOutputTokens: config.localMaximumOutputTokens,
        optionalOpenAiConfigured: config.optionalOpenAiConfigured,
      }}
    />
  );
}
