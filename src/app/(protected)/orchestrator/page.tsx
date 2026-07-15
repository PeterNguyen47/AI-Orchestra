import { OrchestratorShell } from "@/components/orchestrator/orchestrator-shell";
import { loadEnterpriseRagWorkflow } from "@/server/orchestrator/load-enterprise-rag";

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
  return <OrchestratorShell initialWorkflow={result.workflow} />;
}
