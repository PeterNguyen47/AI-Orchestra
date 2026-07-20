# Threat Model

**Status:** Design baseline for a hackathon prototype. AO-003 implements workflow-contract controls; AO-004 implements bounded demonstration authentication and protected-route controls.

## Assets and boundaries

AO-007 implements deterministic pre-request injection screening, manifest/path validation, untrusted-context delimiting, one-request/no-tool execution, structured output, citation allowlisting, sensitive-output blocking, timeout/token/cost/concurrency bounds, and safe error mapping. The relational database remains simulated and untouched. Distributed abuse prevention and production DLP remain residual work.

Protect API credentials, session integrity, workflow definitions, retrieved content, uploaded content, model inputs/outputs, evaluation evidence, exports, and cost budget. Browser, uploads, retrieved text, simulated connectors, and model output are untrusted. Secrets and privileged actions remain server-side.

| Threat | Example | Required control | Validation |
|---|---|---|---|
| Prompt injection | Retrieved document asks the model to ignore policy | Separate instructions from data, delimit context, allowlist actions, apply input/output policy | Adversarial retrieval fixtures |
| Data leakage | Model output exposes secrets or another user's content | Never place secrets in prompts, minimize context, redact logs/exports, scope storage | Canary and cross-session tests |
| Excessive agency | Model takes consequential action without approval | No arbitrary tools; bounded read-only MVP tools; explicit authorization policy | Tool allowlist tests |
| Unauthorized tool execution | Crafted node invokes an undeclared tool | Versioned schema, server-side registry, deny unknown tools | Negative schema/runtime tests |
| Insecure connectors | Connector trusts hostile responses or broad credentials | Simulate CRM in MVP; validate payloads; least privilege and timeouts for future connectors | Malformed-response fixtures |
| Malicious uploads | Oversized or active content attacks parsers | Type/size limits, safe parsing, quarantine/rejection, treat content as data | File-type and size tests |
| Cross-user access | One session reads another architecture | Seeded demo identity with server-side ownership checks; no production multi-tenancy claim | Session-isolation tests |
| Secret exposure | Key appears in Git, logs, UI, or export | Environment injection, ignored files, redaction, secret scanning, rotation playbook | Repository and log scans |
| Denial of wallet | Repeated/large calls consume budget | Rate limits, token caps, timeouts, concurrency limits, usage logging and budget stops | Limit and load tests |
| Credential disclosure | Generated password or runtime secret enters Git, UI, or logs | Ignored split files, restrictive local permissions, placeholders only, recursive log redaction | Setup tests, secret scan, redaction tests |
| Password brute force / enumeration | Attacker distinguishes usernames or retries passwords | Generic failure response, bounded inputs, scrypt, constant-time comparisons | Integration and browser failures; rate limiting remains residual |
| Session theft or fixation | Attacker reuses or supplies a session identifier | Fresh random ID per login, signed eight-hour token, HttpOnly/Lax cookie, Secure in production | Session tamper, expiry, and new-login tests |
| Cookie misuse | Client script reads or broadens the session | Server-set HttpOnly cookie, path `/`, SameSite=Lax, no browser storage | Cookie integration and browser tests |
| Authorization bypass | Proxy redirect is bypassed | Protected server layout re-verifies and fails closed | Authorization and route-protection tests |
| Open redirect | Login forwards to attacker-controlled URL | Fixed internal `/dashboard` and `/login` destinations only | Action and browser tests |
| Sensitive authentication logging | Raw form or session content enters logs | Raw forms are never logged; authentication key families are recursively redacted | Focused structured-log tests |

## AO-004 authentication mitigations and residuals

The single `judge-demo` identity is a local prototype account. Password verification and session issuance remain server-side. The signed token validates one algorithm, issuer, audience, expiration, fixed subject/role, bounded claims, and matching issued/expiry timestamps. Proxy improves navigation but is not the authorization boundary.

There is no production identity provider, registration, recovery, MFA, persistent revocation, distributed rate limiting, or multi-tenant ownership model. Password brute-force rate limiting and stolen-token revocation remain explicit prototype residuals for later security hardening.

## AO-003 workflow-contract mitigations

AO-003 treats workflow JSON as untrusted input and fails closed before any later execution layer can consume it:

| Threat | Implemented schema-level mitigation | Boundary |
|---|---|---|
| Embedded secrets | Secret references accept environment-variable names, never values. Strict parsing rejects invalid reference names, and semantic validation rejects likely credential values in configuration. | Repository secret scanning remains a separate quality gate; runtime secret loading is not implemented. |
| Unknown or smuggled behavior | Strict Zod objects reject unknown root, node, node-configuration, edge, policy, evaluation, and deployment properties. The node discriminant and schema version are closed enumerations. | A future migration must explicitly map every changed field; unknown data is never silently discarded. |
| Unsafe runtime relationships | Semantic validation resolves every endpoint and port, checks direction and data-contract compatibility, rejects self-references and duplicate logical edges, and limits runtime edges to executable nodes. | The validator proves graph integrity only; it does not run a workflow. |
| False executable claims | `implementationStatus` is required and machine-readable. Runtime traversal may contain only `executable` nodes. Advisory edges may describe simulated or roadmap integration but cannot enter runtime traversal. | The Enterprise RAG database node is visibly `simulated`, read-only, and advisory. |
| Unsupported workflow versions | Only schema version `1.0.0` is accepted. Unsupported older versions return an explicit unsupported result; unknown future versions fail closed and require an application upgrade. | No pre-1.0 migration is invented. |
| Excessive tools or cost | Tool policy uses an explicit allowlist, and the seeded template permits no external tools. Positive bounded step, token, and estimated-cost limits are required. | Enforcement during execution is planned for a later bounded issue. |

Structural validation and semantic validation remain distinct. Generated JSON Schema covers portable structure; cross-node runtime integrity, reachability, reference validation, and likely-secret checks are enforced by the side-effect-free semantic validator.

## Residual limitations

Seeded demo authentication, local SQLite, simulated CRM, and hackathon operations are not production controls. Production identity, tenant isolation, connector hardening, retention, audit immutability, incident response, and compliance assessment remain roadmap work.

## AO-005 interaction mitigations

AO-005 treats every canvas edit as untrusted graph input. Complete candidates pass strict structural parsing before state replacement, and accepted candidates are semantically rechecked. Port direction, data-contract compatibility, endpoint existence, duplicate logical edges, self-connections, and runtime/advisory status boundaries are enforced in one pure connection rule module. Node deletion removes incident edges atomically, while invalid candidates leave the prior workflow untouched. React Flow state is presentation-only and is never persisted. Visible status words, edge-mode labels, the read-only inspector, and the non-persistence notice reduce misleading executable claims; keyboard and axe checks cover the interaction surface.

## AO-007 local open-model controls

The local adapter accepts only validated HTTP loopback endpoints and never exposes provider, model, endpoint, or credentials to the browser. It checks the installed `qwen3:4b` identity and digest when available, uses no tools or retries, disables thinking, validates structured output, and maps raw network/HTTP/model failures to safe codes. Deterministic CI uses mocked transport; only the developer live gate contacts local Ollama. Model artifact provenance, local host compromise, resource exhaustion, and unmeasured electricity/hardware cost remain explicit residuals.

## AO-008 evidence and diagnostic controls

AO-008 keeps governed run evidence in memory and validates one strict `RunEvidence 1.0.0` object before it crosses the server-action boundary. The object has no timestamp and stores no question, answer, prompt, instruction, passage, source identifier, raw provider body, raw exception, stack trace, endpoint, header, environment value, session, username, hostname, or filesystem path. Optional observed provider metadata is length-bounded and omitted when it is unsafe.

Diagnostics retain only fixed codes and explanations, canonical stage outcomes, guardrail facts, aggregate retrieval values, target and bounded observed model identity, deterministic evaluator results, reconciled usage/cost, and fixed security-control booleans. The generic logger receives a separate field allowlist; the complete evidence object is never supplied as log context. Sentinel tests prove that user/model content, authorization-like data, and raw errors do not enter the projection.

The deterministic evaluators prove only citation coverage, lexical retrieval-threshold comparison, and successful schema/citation structure. They do not prove factual truth, semantic correctness, legal compliance, human approval, security certification, or penetration-test completion. The relational-database stage remains only `simulated` or `skipped`, and the evidence states that it was not opened or queried.

The AO-008 browser fixture is bound to an operating-system-assigned port on `127.0.0.1`, implements only three fixed Ollama-compatible endpoints, rejects unexpected traffic, bounds request bytes, retains no request body, and permits exactly one chat generation across the successful and blocked scenarios. It is deterministic test infrastructure, not live-provider evidence. The ignored AO-007 receipt remains the separate live Ollama proof.
