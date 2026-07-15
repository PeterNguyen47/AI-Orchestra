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
