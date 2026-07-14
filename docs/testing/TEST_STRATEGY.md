# Test Strategy

## Quality gates

When commands exist, every pull request runs formatting/lint, TypeScript typecheck, unit tests, integration tests, production build, and secret/dependency checks. Demo-critical changes also run the judge path.

## Planned test layers

- **Schema/unit:** version parsing, migrations, node configuration, graph rules, policy decisions, redaction, cost limits.
- **Integration:** persistence, retrieval fixtures, server-side model adapter with deterministic fakes, exports, session ownership.
- **Contract:** GPT-5.6 response parsing and bounded Agents SDK behavior using recorded non-sensitive fixtures; live checks are separately gated.
- **Security:** prompt injection, data leakage canaries, unknown tools, malicious uploads, cross-user access, secret exposure, and denial-of-wallet limits.
- **End to end:** seeded login through template load, configure, validate, execute, inspect diagnostics/evaluation, and export.
- **Portable/judge:** clean Docker startup with documented sample data and a timed test path.

## Evidence policy

Tests must state whether they used a fake, simulated node, or live service. A simulated or mocked pass cannot substantiate live execution. Flaky tests are failures until resolved or explicitly quarantined with an issue.
