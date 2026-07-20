import type { ReactNode } from "react";
import type { RunEvidence } from "@/domain/runtime/run-evidence";

const STATUS_LABELS: Readonly<Record<RunEvidence["status"], string>> = {
  completed: "Completed",
  blocked: "Blocked",
  failed: "Failed",
  busy: "Busy",
  "not-configured": "Not configured",
};

const STAGE_LABELS: Readonly<Record<RunEvidence["timeline"][number]["nodeId"], string>> = {
  "user-input": "User input",
  "input-guardrail": "Input guardrail",
  "document-source": "Document source",
  retrieval: "Retrieval",
  "gpt-agent": "Model agent",
  "output-guardrail": "Output guardrail",
  evaluator: "Evaluator",
  "response-output": "Response output",
  "simulated-relational-database": "Relational database",
};

const OUTCOME_LABELS: Readonly<Record<RunEvidence["timeline"][number]["outcome"], string>> = {
  passed: "Passed",
  blocked: "Blocked",
  failed: "Failed",
  simulated: "Simulated",
  skipped: "Skipped",
  "not-started": "Not started",
};

const EVALUATOR_LABELS: Readonly<Record<string, string>> = {
  "citation_coverage.v1": "Citation coverage",
  "retrieval_relevance.v1": "Retrieval relevance",
  "structural_grounding.v1": "Structural grounding",
};

const titleCase = (value: string) =>
  value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const yesNo = (value: boolean) => (value ? "Yes" : "No");
const score = (value: number) => String(value);
const cost = (value: number) => {
  const serialized = String(value);
  if (/[eE]/.test(serialized)) return `$${serialized}`;
  const [whole, fraction = ""] = serialized.split(".");
  return `$${whole}.${fraction.padEnd(2, "0")}`;
};

function Fact({ term, children }: Readonly<{ term: string; children: ReactNode }>) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function GovernedRunEvidence({ evidence }: Readonly<{ evidence: RunEvidence }>) {
  const databaseStage = evidence.timeline.find(
    (entry) => entry.nodeId === "simulated-relational-database",
  );
  const databaseSimulated = databaseStage?.outcome === "simulated";
  const hasGuardrailDecision =
    evidence.inputGuardrailDecision !== undefined || evidence.outputGuardrailDecision !== undefined;

  return (
    <section
      className="governed-run-evidence"
      aria-labelledby="governed-run-evidence-title"
      data-testid="governed-run-evidence"
    >
      <header className="run-evidence-header">
        <p className="eyebrow">In-memory evidence · Schema {evidence.schemaVersion}</p>
        <h3 id="governed-run-evidence-title">Governed run evidence</h3>
        <p className="run-evidence-overall" data-testid="run-evidence-overall">
          <strong>{STATUS_LABELS[evidence.status]}.</strong> {evidence.explanation}
        </p>
        <p className="run-evidence-identifiers">
          Diagnostic <code>{evidence.code}</code> · Run <code>{evidence.runId}</code>
        </p>
      </header>

      <section className="run-evidence-section" aria-labelledby="run-evidence-timeline-title">
        <h4 id="run-evidence-timeline-title">Ordered execution timeline</h4>
        <ol className="run-evidence-timeline" data-testid="run-evidence-timeline">
          {evidence.timeline.map((entry) => (
            <li
              className={`run-evidence-stage run-evidence-stage-${entry.outcome}`}
              data-stage-id={entry.nodeId}
              data-stage-outcome={entry.outcome}
              key={entry.nodeId}
            >
              <strong>{STAGE_LABELS[entry.nodeId]}</strong>
              <span>Status: {OUTCOME_LABELS[entry.outcome]}</span>
            </li>
          ))}
        </ol>
      </section>

      {hasGuardrailDecision && (
        <section className="run-evidence-section" aria-labelledby="guardrail-decisions-title">
          <h4 id="guardrail-decisions-title">Guardrail decisions</h4>
          <div className="run-evidence-card-grid">
            {evidence.inputGuardrailDecision && (
              <article className="run-evidence-card" data-testid="input-guardrail-decision">
                <h5>Input guardrail</h5>
                <p>{evidence.inputGuardrailDecision.explanation}</p>
                <dl>
                  <Fact term="Decision">{titleCase(evidence.inputGuardrailDecision.status)}</Fact>
                  <Fact term="Diagnostic code">
                    <code>{evidence.inputGuardrailDecision.code}</code>
                  </Fact>
                  <Fact term="Input characters">
                    {evidence.inputGuardrailDecision.inputCharacterCount}
                  </Fact>
                  <Fact term="Maximum input length">
                    {evidence.inputGuardrailDecision.maximumInputCharacters}
                  </Fact>
                  <Fact term="Injection detection">
                    {evidence.inputGuardrailDecision.promptInjectionDetectionEnabled
                      ? "Enabled"
                      : "Disabled"}
                  </Fact>
                </dl>
              </article>
            )}
            {evidence.outputGuardrailDecision && (
              <article className="run-evidence-card" data-testid="output-guardrail-decision">
                <h5>Output guardrail</h5>
                <p>{evidence.outputGuardrailDecision.explanation}</p>
                <dl>
                  <Fact term="Decision">{titleCase(evidence.outputGuardrailDecision.status)}</Fact>
                  <Fact term="Diagnostic code">
                    <code>{evidence.outputGuardrailDecision.code}</code>
                  </Fact>
                  <Fact term="Schema validated">
                    {yesNo(evidence.outputGuardrailDecision.schemaValidated)}
                  </Fact>
                  <Fact term="Citations required">
                    {yesNo(evidence.outputGuardrailDecision.citationsRequired)}
                  </Fact>
                  <Fact term="Citations validated">
                    {yesNo(evidence.outputGuardrailDecision.citationsValidated)}
                  </Fact>
                  <Fact term="Citations accepted">
                    {evidence.outputGuardrailDecision.acceptedCitationCount}
                  </Fact>
                  <Fact term="Active content detected">
                    {yesNo(evidence.outputGuardrailDecision.activeContentDetected)}
                  </Fact>
                  <Fact term="Sensitive data detected">
                    {yesNo(evidence.outputGuardrailDecision.sensitiveDataDetected)}
                  </Fact>
                  <Fact term="Insufficient context">
                    {yesNo(evidence.outputGuardrailDecision.insufficientContext)}
                  </Fact>
                </dl>
              </article>
            )}
          </div>
        </section>
      )}

      {evidence.retrievalEvidence && (
        <section className="run-evidence-section" aria-labelledby="retrieval-evidence-title">
          <h4 id="retrieval-evidence-title">Retrieval evidence</h4>
          <p>{evidence.retrievalEvidence.explanation}</p>
          <dl className="run-evidence-metrics" data-testid="retrieval-evidence">
            <Fact term="Status">{titleCase(evidence.retrievalEvidence.status)}</Fact>
            <Fact term="Diagnostic code">
              <code>{evidence.retrievalEvidence.code}</code>
            </Fact>
            <Fact term="Requested top K">{evidence.retrievalEvidence.requestedTopK}</Fact>
            <Fact term="Chunks returned">{evidence.retrievalEvidence.returnedChunkCount}</Fact>
            <Fact term="Minimum threshold">
              {score(evidence.retrievalEvidence.minimumRelevanceThreshold)}
            </Fact>
            <Fact term="Maximum context">
              {evidence.retrievalEvidence.maximumContextCharacters} characters
            </Fact>
            <Fact term="Minimum relevance">
              {score(evidence.retrievalEvidence.relevance.minimum)}
            </Fact>
            <Fact term="Maximum relevance">
              {score(evidence.retrievalEvidence.relevance.maximum)}
            </Fact>
            <Fact term="Mean relevance">{score(evidence.retrievalEvidence.relevance.mean)}</Fact>
          </dl>
        </section>
      )}

      {evidence.modelEvidence && (
        <section className="run-evidence-section" aria-labelledby="model-evidence-title">
          <h4 id="model-evidence-title">Model evidence</h4>
          <dl className="run-evidence-metrics" data-testid="model-evidence">
            <Fact term="Target provider">{evidence.modelEvidence.target.provider}</Fact>
            <Fact term="Target model">{evidence.modelEvidence.target.model}</Fact>
            <Fact term="Deployment mode">
              {titleCase(evidence.modelEvidence.target.deploymentMode.replaceAll("_", "-"))}
            </Fact>
            <Fact term="Invocation reached">{yesNo(evidence.modelEvidence.invocationReached)}</Fact>
            {evidence.modelEvidence.observed?.model && (
              <Fact term="Observed model">{evidence.modelEvidence.observed.model}</Fact>
            )}
            {evidence.modelEvidence.observed?.modelDigest && (
              <Fact term="Model digest">
                <code>{evidence.modelEvidence.observed.modelDigest}</code>
              </Fact>
            )}
            {evidence.modelEvidence.observed?.runtime && (
              <Fact term="Runtime">{evidence.modelEvidence.observed.runtime}</Fact>
            )}
            {evidence.modelEvidence.observed?.runtimeVersion && (
              <Fact term="Runtime version">{evidence.modelEvidence.observed.runtimeVersion}</Fact>
            )}
          </dl>
        </section>
      )}

      {evidence.evaluatorResults && (
        <section className="run-evidence-section" aria-labelledby="evaluator-results-title">
          <h4 id="evaluator-results-title">Deterministic evaluator results</h4>
          <ul className="run-evidence-evaluators" data-testid="evaluator-results">
            {evidence.evaluatorResults.map((result) => (
              <li data-evaluator-id={result.evaluatorId} key={result.evaluatorId}>
                <h5>{EVALUATOR_LABELS[result.evaluatorId] ?? result.evaluatorId}</h5>
                <p>{result.explanation}</p>
                <dl>
                  <Fact term="Status">{titleCase(result.status)}</Fact>
                  <Fact term="Score">{score(result.score)}</Fact>
                  <Fact term="Threshold">{score(result.threshold)}</Fact>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="run-evidence-section" aria-labelledby="run-metrics-title">
        <h4 id="run-metrics-title">Run metrics</h4>
        <dl className="run-evidence-metrics" data-testid="run-evidence-metrics">
          <Fact term="Total duration">{evidence.metrics.totalDurationMs} ms</Fact>
          {evidence.metrics.providerDurationMs !== undefined && (
            <Fact term="Provider duration">{evidence.metrics.providerDurationMs} ms</Fact>
          )}
          {evidence.metrics.usage && (
            <>
              <Fact term="Input tokens">{evidence.metrics.usage.inputTokens}</Fact>
              <Fact term="Output tokens">{evidence.metrics.usage.outputTokens}</Fact>
              <Fact term="Total tokens">{evidence.metrics.usage.totalTokens}</Fact>
            </>
          )}
          {evidence.metrics.estimatedCostUsd !== undefined && (
            <Fact term="Estimated cost">{cost(evidence.metrics.estimatedCostUsd)}</Fact>
          )}
          {evidence.metrics.externalApiCostUsd !== undefined && (
            <Fact term="External API cost">{cost(evidence.metrics.externalApiCostUsd)}</Fact>
          )}
          <Fact term="Local compute cost">
            {evidence.metrics.localComputeCostMeasured ? "Measured" : "Not measured"}
          </Fact>
        </dl>
      </section>

      <section className="run-evidence-section" aria-labelledby="security-controls-title">
        <h4 id="security-controls-title">Execution controls</h4>
        <dl className="run-evidence-metrics" data-testid="security-controls">
          <Fact term="Model calls server-side">
            {yesNo(evidence.securityControls.modelCallsServerSide)}
          </Fact>
          <Fact term="Provider selection exposed">
            {yesNo(evidence.securityControls.providerSelectionExposedToBrowser)}
          </Fact>
          <Fact term="Credentials stored">
            {yesNo(evidence.securityControls.credentialsStored)}
          </Fact>
          <Fact term="Prompts stored">{yesNo(evidence.securityControls.promptsStored)}</Fact>
          <Fact term="Raw errors stored">{yesNo(evidence.securityControls.rawErrorsStored)}</Fact>
          <Fact term="Database opened">{yesNo(evidence.securityControls.databaseOpened)}</Fact>
          <Fact term="Database queried">{yesNo(evidence.securityControls.databaseQueried)}</Fact>
          <Fact term="Tools used">{yesNo(evidence.securityControls.toolsUsed)}</Fact>
          <Fact term="Handoffs used">{yesNo(evidence.securityControls.handoffsUsed)}</Fact>
          <Fact term="Thinking stored">{yesNo(evidence.securityControls.thinkingStored)}</Fact>
          <Fact term="Persistence used">{yesNo(evidence.securityControls.persistenceUsed)}</Fact>
          <Fact term="Remote tracing used">
            {yesNo(evidence.securityControls.remoteTracingUsed)}
          </Fact>
        </dl>
      </section>

      <aside
        className="database-evidence"
        aria-labelledby="database-evidence-title"
        data-testid="database-evidence"
        role="note"
      >
        <h4 id="database-evidence-title">
          {databaseSimulated ? "Simulated relational database" : "Relational database skipped"}
        </h4>
        <p>
          {databaseSimulated
            ? "The database node was represented as simulated evidence only. It was not opened or queried."
            : "The database node was skipped for this run. It was not opened or queried."}
        </p>
      </aside>
    </section>
  );
}
