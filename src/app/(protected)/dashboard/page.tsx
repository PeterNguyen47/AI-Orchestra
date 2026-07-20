import { StatusCard } from "@/components/dashboard/status-card";
import { getEnterpriseRagDashboardSummary } from "@/server/dashboard/dashboard-summary";

export default function DashboardPage() {
  const summary = getEnterpriseRagDashboardSummary();
  return (
    <main className="dashboard-shell" id="main-content">
      <nav className="dashboard-nav" aria-label="Dashboard sections">
        <a href="#overview">Dashboard</a>
        <a href="#enterprise-rag">Enterprise RAG blueprint</a>
        <a href="#security-governance">Security and governance</a>
        <a href="#roadmap">Roadmap</a>
        <a href="https://github.com/PeterNguyen47/AI-Orchestra#readme">Repository documentation</a>
      </nav>
      <section className="dashboard-hero" id="overview" aria-labelledby="dashboard-title">
        <div>
          <p className="eyebrow">Current product stage Â· AO-005</p>
          <h1 id="dashboard-title">Blueprint status, without the theater.</h1>
          <p>
            Authentication, dashboard, and visual workflow composition are executable product
            surfaces. Model, retrieval, evaluation, and export execution remain clearly scheduled.
          </p>
        </div>
        <aside className="truth-panel" id="security-governance" aria-label="Security boundary">
          <span className="status-label status-contract">Server protected</span>
          <strong>Session ownership is rechecked in the protected layout.</strong>
          <p>Proxy redirects are only an optimistic navigation layer.</p>
        </aside>
      </section>
      <section className="card-section" id="roadmap" aria-labelledby="status-title">
        <div className="section-heading">
          <p className="eyebrow">Capability map</p>
          <h2 id="status-title">What exists nowâ€”and what does not</h2>
        </div>
        <div className="card-grid">
          <StatusCard
            id="enterprise-rag"
            title="Enterprise RAG Blueprint"
            status="Contract ready"
            statusKind="contract"
          >
            <dl className="metric-grid">
              <div>
                <dt>Schema version</dt>
                <dd>{summary.schemaVersion}</dd>
              </div>
              <div>
                <dt>Nodes</dt>
                <dd>{summary.nodeCount}</dd>
              </div>
              <div>
                <dt>Executable nodes</dt>
                <dd>{summary.executableNodeCount}</dd>
              </div>
              <div>
                <dt>Simulated nodes</dt>
                <dd>{summary.simulatedNodeCount}</dd>
              </div>
              <div>
                <dt>Runtime edges</dt>
                <dd>{summary.runtimeEdgeCount}</dd>
              </div>
              <div>
                <dt>Advisory edges</dt>
                <dd>{summary.advisoryEdgeCount}</dd>
              </div>
              <div>
                <dt>Semantic validation</dt>
                <dd>{summary.semanticValidationStatus}</dd>
              </div>
            </dl>
            <p>Counts are parsed and validated from the canonical Enterprise RAG template.</p>
          </StatusCard>
          <StatusCard
            id="visual-orchestrator"
            title="Visual Orchestrator"
            status="Executable AO-005"
            statusKind="contract"
          >
            <p>The protected canvas renders and safely edits the canonical workflow in memory.</p>
            <a className="card-link" href="/orchestrator">
              Open visual orchestrator
            </a>
          </StatusCard>
          <StatusCard
            id="architecture-validation"
            title="Architecture Validation"
            status="Planned AO-006"
          >
            <p>
              The AO-003 contract validator is implemented; user-facing architecture validation is
              future work.
            </p>
          </StatusCard>
          <StatusCard
            id="rag-runtime"
            title="Local Open-Model RAG Runtime"
            status="Executable AO-007"
            statusKind="contract"
          >
            <p>
              Governed local Ollama with Qwen3 4B executes the readiness-approved RAG path when the
              server-side local runtime flag and required model are available.
            </p>
          </StatusCard>
          <StatusCard id="diagnostics" title="Diagnostics and Evaluation" status="Planned AO-008">
            <p>Evaluation configuration exists in the contract. Evaluation execution does not.</p>
          </StatusCard>
          <StatusCard id="exports" title="Architecture Exports" status="Planned AO-009">
            <p>
              Versioned workflow JSON and human-readable architecture and assurance exports are
              intended, not currently generated.
            </p>
          </StatusCard>
        </div>
      </section>
    </main>
  );
}
