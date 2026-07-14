import { siteConfig } from "@/config/site";

const foundationChecks = [
  "Strict TypeScript application shell",
  "Server-only runtime configuration",
  "Redacting structured JSON logs",
  "Automated quality and container checks",
] as const;

export default function Home() {
  return (
    <main className="page-shell">
      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />

      <section className="hero" aria-labelledby="page-title">
        <div className="eyebrow-row">
          <span className="status-dot" aria-hidden="true" />
          <span>{siteConfig.implementationStatus}</span>
          <span aria-hidden="true">·</span>
          <span>{siteConfig.status}</span>
        </div>

        <p className="kicker">OpenAI Build Week 2026 · {siteConfig.track}</p>
        <h1 id="page-title">{siteConfig.name}</h1>
        <p className="hero-copy">{siteConfig.description}</p>

        <div className="scope-note" role="note">
          <span className="scope-label">AO-002 boundary</span>
          <p>
            The platform foundation is running. Architecture composition, RAG execution, and
            enterprise connectors remain intentionally scheduled for later bounded issues.
          </p>
        </div>
      </section>

      <section className="foundation-panel" aria-labelledby="foundation-title">
        <div>
          <p className="panel-kicker">Runtime readiness</p>
          <h2 id="foundation-title">A dependable base for the vertical slice</h2>
        </div>

        <ul className="check-grid">
          {foundationChecks.map((check) => (
            <li key={check}>
              <span className="check-mark" aria-hidden="true">
                ✓
              </span>
              <span>{check}</span>
            </li>
          ))}
        </ul>

        <a className="health-link" href="/api/health">
          View runtime health
          <span aria-hidden="true">→</span>
        </a>
      </section>
    </main>
  );
}
