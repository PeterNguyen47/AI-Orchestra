# Test Strategy

## Quality gates

When commands exist, every pull request runs formatting/lint, TypeScript typecheck, unit tests, integration tests, production build, and secret/dependency checks. Demo-critical changes also run the judge path.

AO-002 implements the foundation gates as `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run security:secrets`, `npm run security:audit`, and `npm run build`. GitHub Actions also builds and starts Docker Compose, checks the application and health endpoint, confirms a structured health log, and tears down the stack.

## Planned test layers

- **Schema/unit:** version parsing, migrations, node configuration, graph rules, policy decisions, redaction, cost limits.
- **Integration:** persistence, retrieval fixtures, server-side model adapter with deterministic fakes, exports, session ownership.
- **Contract:** GPT-5.6 response parsing and bounded Agents SDK behavior using recorded non-sensitive fixtures; live checks are separately gated.
- **Security:** prompt injection, data leakage canaries, unknown tools, malicious uploads, cross-user access, secret exposure, and denial-of-wallet limits.
- **End to end:** seeded login through template load, configure, validate, execute, inspect diagnostics/evaluation, and export.
- **Portable/judge:** clean Docker startup with documented sample data and a timed test path.

The AO-002 unit suite covers public seeded configuration, runtime environment validation, structured log shape, sensitive-key redaction, error serialization, and circular data. This does not substitute for later workflow, model, security-adversarial, or end-to-end product tests.

## Evidence policy

Tests must state whether they used a fake, simulated node, or live service. A simulated or mocked pass cannot substantiate live execution. Flaky tests are failures until resolved or explicitly quarantined with an issue.
