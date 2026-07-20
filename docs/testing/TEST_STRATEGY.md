# Test Strategy

## Quality gates

When commands exist, every pull request runs formatting/lint, TypeScript typecheck, unit tests, integration tests, production build, and secret/dependency checks. Demo-critical changes also run the judge path.

AO-002 implements the foundation gates as `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run security:secrets`, `npm run security:audit`, and `npm run build`. GitHub Actions also builds and starts Docker Compose, checks the application and health endpoint, confirms a structured health log, and tears down the stack.

AO-003 extends those gates with deterministic workflow-schema generation (`npm run schema:generate`) and a committed-artifact drift check (`npm run schema:check`). GitHub Actions runs the drift check before coverage. The committed Enterprise RAG fixture is parsed by the canonical parser, semantically validated, and checked as JSON without network access, credentials, system time, or random identifiers.

AO-004 adds unit/integration coverage for credential setup, scrypt hashes, generic credential failures, signed-session claims and failure modes, protected authorization, cookie creation/deletion, dashboard derivation, and authentication log redaction. A Chromium Playwright job generates ephemeral test credentials, verifies login/navigation/card expansion/logout/route protection, runs axe against login and dashboard with no serious or critical violations, and uploads screenshots and failure traces.

## Implemented AO-003 coverage

- **Structural:** valid fixture parsing plus rejection of unknown root, node, node-type, configuration, and version data; missing fields; invalid classifications, thresholds, execution limits, and environment-variable references.
- **Semantic:** duplicate node, edge, and per-node port IDs; unresolved nodes and ports; wrong port directions; self-references; duplicate logical edges; incompatible data contracts; runtime edges touching simulated or roadmap nodes; disconnected executable nodes; missing input/output nodes and runtime paths; and likely embedded secrets.
- **Runtime-path boundary:** advisory edges are excluded from runtime traversal, and the valid simulated relational-database node cannot become part of the executable path.
- **Versioning:** current-version migration plus explicit missing, malformed, unsupported older, and application-upgrade-required future-version outcomes.
- **Portability:** parse/serialize/reparse round trips, deterministic serializer output, valid JSON fixture loading, native Draft 2020-12 generation, and committed-schema drift detection.

These are contract tests only. They do not execute retrieval, model calls, guardrails, evaluation, database access, document ingestion, or other product behavior.

## Test layers

- **Schema/unit:** AO-003 covers version parsing, current migration behavior, strict node configuration, graph rules, policy bounds, reference hygiene, round trips, and schema drift. Runtime policy decisions, redaction, and cost enforcement remain planned.
- **Integration:** persistence, retrieval fixtures, server-side model adapter with deterministic fakes, exports, session ownership.
- **Contract:** GPT-5.6 response parsing and bounded Agents SDK behavior using recorded non-sensitive fixtures; live checks are separately gated.
- **Security:** prompt injection, data leakage canaries, unknown tools, malicious uploads, cross-user access, secret exposure, and denial-of-wallet limits.
- **End to end:** seeded login through template load, configure, validate, execute, inspect diagnostics/evaluation, and export.
- **AO-004 end to end:** unauthenticated redirect, generic invalid login, valid generated login, anchor navigation, keyboard card expansion, canonical template counts, logout, post-logout denial, responsive smoke, and axe checks.
- **Portable/judge:** clean Docker startup with documented sample data and a timed test path.

The AO-002 unit suite covers public seeded configuration, runtime environment validation, structured log shape, sensitive-key redaction, error serialization, and circular data. The AO-003 suite adds workflow-contract coverage, but neither suite substitutes for later model, security-adversarial, integration, or end-to-end product tests.

## Evidence policy

Tests must state whether they used a fake, simulated node, or live service. A simulated or mocked pass cannot substantiate live execution. Flaky tests are failures until resolved or explicitly quarantined with an issue.

## AO-005 visual-composition coverage

The orchestrator unit suite covers canonical-to-canvas mapping, all nine catalog factories, roadmap/simulated defaults, deterministic IDs, pure position/add/delete/reset mutations, compatible runtime and advisory edges, invalid direction/contracts, duplicates, self-connections, missing endpoints, and structural rejection. The Chromium suite covers protected navigation, nine-node/eight-edge rendering, visible status and mode claims, keyboard selection and movement, toolbox addition, accessible advisory connection creation, concise rejection, atomic deletion, reset, reload non-persistence, desktop/mobile layout, screenshots, and axe with no serious or critical violations. No visual-composition test implies node configuration editing or live execution.

## AO-006 configuration and validation coverage

The AO-006 unit suite exhaustively checks the field catalog for all nine node types, factory-backed safe defaults, preservation of protected properties and edges, atomic valid updates, field-level rejection, declared numeric boundaries, unified structural/semantic/architecture findings, deterministic ordering, readiness blocking, malicious synthetic credential shapes, and warning-only paths. The Chromium path edits retrieval configuration, proves out-of-range values leave the canonical workflow ready and unchanged, applies a valid value, creates and filters a citation-policy error, verifies readiness is blocked, restores the valid policy, captures a screenshot, and retains axe coverage. These checks validate configuration and future-execution readiness only; no live model, retrieval, evaluator, guardrail, or tool call occurs.

# AO-007 deterministic and live evidence

Unit and integration tests cover plan compilation, unsupported targets, readiness, zero-call guardrail and no-match paths, one-call success, deterministic retrieval, traversal, injection fixtures, limits, timeout/concurrency release, citations, sensitive output, and safe provider errors. Browser tests cover the protected, responsive, keyboard-accessible, axe-checked not-configured panel without an API key.

CI and Docker use deterministic key-free paths. The separate `npm run test:live:ao007` gate checks local Ollama metadata and performs exactly one `qwen3:4b` generation request using the committed workflow and corpus. Deterministic results never substitute for local live evidence.

## AO-007 local-model evidence

Hosted CI requires neither Ollama nor model artifacts. Mocked native-fetch tests cover structured success, token/duration normalization, one generation request, no retry, no thinking return, unexpected tool calls, wrong identity, unavailable runtime, missing model, malformed JSON, invalid schema, timeout, safe HTTP mapping, and loopback URL rejection. Integration tests preserve zero-call readiness/input/no-match paths and exactly one successful generation call. Browser tests cover the disabled/unavailable presentation without provider, model, or endpoint overrides.

The separate `npm run test:live:ao007` gate requires `AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED=true`, a responding validated loopback endpoint, and exactly `qwen3:4b`. It uses committed data, performs metadata checks and one generation request, and writes only the ignored sanitized receipt. `npm run test:live:ao007:openai` is optional future work and is not run for this package.

## AO-008 governed evidence coverage

AO-008 adds contract, evaluator, recorder, log-projection, renderer, executor, action, and browser coverage. The deterministic unit suite validates strict `RunEvidence 1.0.0` parsing, canonical nine-stage ordering, retained prior-stage outcomes, stable key-sorted serialization, fixed diagnostic explanations, token reconciliation, metadata bounds, illegal recorder transitions, second-terminal rejection, and sentinel redaction.

The three evaluators are side-effect free and model free. Citation coverage uses validated required-citation and accepted-identifier counts; retrieval relevance uses rounded aggregate lexical values already produced by retrieval; structural grounding uses only successful output-schema and citation-structure facts. Tests assert both threshold outcomes and the fixed explanations, without making factual-truth, semantic-correctness, legal, certification, or human-review claims.

The browser runner first executes the original six Chromium scenarios with AO-007/Ollama/OpenAI runtime variables removed. It then stops that application, starts a bounded loopback fixture plus a second enabled standalone application, and runs only the `@ao008` scenario. That scenario covers one successful run and one input-guardrail block while requiring exactly one `/api/chat` request, nine ordered stages, retained/skipped outcomes, guardrail and evaluator explanations, usage/duration/cost/provider facts, answer/diagnostic separation, responsive layout, sentinel exclusion, and axe results. The fixture is not native Ollama or OpenAI evidence.

The separate AO-007 live launcher and ignored local receipt remain unchanged. Neither deterministic CI nor the AO-008 browser fixture substitutes for that live Ollama evidence.
