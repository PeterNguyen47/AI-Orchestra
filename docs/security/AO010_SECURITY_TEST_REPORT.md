# AO-010 deterministic security-assurance report

## Scope and status semantics

This report covers automated adversarial assurance for the single-subject MVP judge path. It is not a penetration test, certification, SOC 2 assessment, security approval, production-readiness claim, enterprise incident program, or zero-risk claim.

- `implemented`: the bounded judge-path control is present and has deterministic evidence.
- `not_applicable`: the feature or attack surface is absent from the MVP.
- `residual_accepted`: bounded controls exist, but a documented medium or low limitation remains.
- `blocked`: a critical or high judge-path gap prevents AO-010 completion.

AO-010 completion requires no blocked threat and no unresolved critical or high finding. The machine-readable evidence schema is `1.0.0` in `src/domain/security/security-assurance.ts`; it is test and documentation evidence only, not a product export, UI surface, log record, or persisted artifact.

## Threat and control status matrix

| Threat ID | Status | Judge-path control and evidence |
|---|---|---|
| `AO10-PROMPT-INJECTION` | `residual_accepted` | NFKC normalization, zero-width removal, bounded spaced and compact representations, fixed direct-input rules, trusted instruction separation, untrusted retrieval context, a system-instruction canary, and output blocking are unit tested. Semantic variants remain a medium residual. |
| `AO10-INFORMATION-LEAKAGE` | `residual_accepted` | Output, RunEvidence, log, export, error, health, and browser surfaces use fixed schemas, positive allowlists, sensitive-text blocking, value redaction, and synthetic canaries. Full production DLP remains a medium residual. |
| `AO10-EXCESSIVE-AGENCY` | `implemented` | Tools and handoffs are empty, exactly one generation is permitted, the database is simulated, and readiness blocks unsupported execution. |
| `AO10-UNAUTHORIZED-TOOLS` | `implemented` | Architecture validation and runtime planning reject undeclared tools before provider construction or side effects. |
| `AO10-CONNECTOR-ABUSE` | `not_applicable` | No live connector route, credential, fetch, or invocation surface exists. CRM-style nodes remain simulated or advisory. |
| `AO10-UPLOAD-ABUSE` | `not_applicable` | No file input, upload route, multipart parser, quarantine store, or upload persistence exists. Declarative `sourceMode=upload` is valid design data but blocks readiness with `UPLOAD_SOURCE_UNSUPPORTED`. |
| `AO10-CROSS-USER-ACCESS` | `not_applicable` | The MVP has one logical demonstration identity and makes no multi-tenant claim. Protected routes/actions fail closed, cookies are verified, browser state is in memory, and isolated contexts do not share workflow or run state. |
| `AO10-SECRET-EXPOSURE` | `residual_accepted` | Shared boolean-only detection, output blocking, generic log redaction, fail-closed exports, committed-secret scanning, error suppression, and allowlisted evidence are tested. Production secret management and DLP remain a medium residual. |
| `AO10-DENIAL-OF-WALLET` | `implemented` | One generation, token/cost limits, provider-disabled defaults, action-size checks, authenticated-subject rate limits, timeouts, and zero-call blocked paths bound judge-path spend. |
| `AO10-DENIAL-OF-SERVICE` | `residual_accepted` | Input/workflow/context/output/body bounds, concurrency guards, timeouts, a 1,024-entry limiter, and process cleanup are tested. The limiter is process-local and not a distributed availability control. |

No threat is `blocked`. No unresolved critical or high judge-path finding remains.

## Implemented adversarial matrix

| Vector | Trust boundary | Expected fixed control | Side effects and disclosure |
|---|---|---|---|
| Instruction override and system-instruction disclosure | Browser to input guardrail | Existing override/extraction codes plus new role, policy, tool, exfiltration, and encoded-instruction codes | Zero provider calls when blocked; no matched text returned. |
| Hostile retrieved instruction | Corpus to model context | Retrieved text remains delimited untrusted context; trusted instructions contain the canary prohibition | One bounded generation at most; retrieved text cannot enter the system message. |
| Unauthorized tool or handoff declaration | Workflow to validation/runtime plan | `UNAPPROVED_TOOL` or runtime-plan rejection | Zero adapter construction, provider calls, or tool side effects. |
| Upload-mode workflow | Workflow to readiness | `UPLOAD_SOURCE_UNSUPPORTED` | Execution blocked; no upload system is created. |
| Synthetic sensitive output | Provider result to output guardrail | `OUTPUT_SENSITIVE_DATA` | No answer presentation; RunEvidence records only a boolean decision. |
| Sensitive workflow export | Workflow to browser artifact | `EXPORT_WORKFLOW_UNSAFE` | No partial artifact or Blob; no matched value or path returned. |
| Raw exception and sensitive log value | Server value to structured log | Fixed error projection and `REDACTED_VALUE` | No message, stack, or sentinel in the log record. |
| Missing, malformed, expired, or tampered cookie | Browser to protected route/action | Session verification and generic authentication failure | No protected state or raw token disclosure. |
| Cross-browser state probe | Browser memory boundary | Per-page in-memory workflow, answer, RunEvidence, and export binding | No shared client storage or state. |
| Oversized question or workflow | Server action boundary | `REQUEST_INVALID`; 8,000 characters and 1,000,000 UTF-8 bytes | Zero compilation, adapter construction, or provider calls. |
| Repeated authenticated requests | Session subject to process-local limiter | `RATE_LIMIT_EXCEEDED`; seventh request in 60 seconds | Bounded retry metadata only; zero downstream side effects. |
| Concurrent or second generation | Runtime and fixture | Existing active-run/global concurrency guards and one-chat fixture | One generation maximum; second fixture chat is rejected. |
| Provider timeout | Adapter to executor | Existing fixed timeout codes | No retry and safe error projection. |
| Fixture endpoint misuse or excess body | Test client to loopback fixture | Exact endpoint/method allowlist and 64 KiB body bound | Rejected locally; body is neither retained nor logged. |

## Fixed bounds

- Server-action question: at most 8,000 JavaScript characters; the canonical input guardrail remains 4,000 characters.
- Serialized workflow: at most 1,000,000 UTF-8 bytes.
- Workflow graph schema: at most 256 nodes and 1,024 edges; at most 32 ports per node.
- Canonical retrieval: `topK` and context-character bounds remain schema controlled; the committed workflow uses five chunks and 24,000 context characters.
- Local provider timeout: 15,000 through 180,000 milliseconds; configured default 120,000.
- Local output tokens: 128 through 2,048; configured default 1,024.
- Runtime total tokens: configured maximum at most 25,000; committed workflow policy values remain independently schema bounded.
- Concurrent runs: configured one through four, plus the existing per-subject active-run guard.
- Authenticated attempts: six per subject digest per 60-second fixed window; the seventh is blocked with retry-after metadata from 1 through 60 seconds.
- Limiter storage: 1,024 process-local digest entries; expired entries are pruned and new subjects fail closed at capacity.
- Downloadable artifact text: at most 8,000,000 characters and 16,000,000 UTF-8 bytes; filenames remain at most 180 characters.
- Loopback fixture request body: at most 64 KiB and exactly one successful chat request.

The rate limiter stores only a lower-case SHA-256 subject digest, window start, and count. It never logs a subject, cookie, session identifier, or digest. It resets on process restart and does not claim distributed quota or production denial-of-service protection.

## Authentication, network, container, and persistence boundaries

The application uses one logical demo subject. The signed cookie remains `httpOnly`, `SameSite=Lax`, path scoped, time bounded, and secure in production. Local HTTP is a development exception. Logout deletes the browser cookie; it does not claim server-side token revocation. Same-origin and SameSite behavior are judge-path controls, not an explicit anti-CSRF token system.

Browser code cannot select endpoints, models, or credentials. Native Ollama remains loopback-only and optional OpenAI execution remains disabled by default. AO-010 did not contact either provider. The deterministic fixture binds only to `127.0.0.1` on an operating-system-assigned ephemeral port. There is no arbitrary URL fetch, upload service, live connector, tool, handoff, database query, or persistence layer.

The existing container remains non-root, read-only, capability dropped, and temporary-cache bounded. Existing security headers remain unchanged. A nonce-aware production Content Security Policy is a low residual because an untested CSP could break the Next.js runtime, browser downloads, Web Crypto, or the local judge path.

## Leakage and evidence boundary

The shared detector returns only a boolean. It covers private-key headers, credential shapes and assignments, bearer authorization, cookie/session material, database or credential-bearing URLs, absolute machine paths, and prohibited controls. Tests construct harmless synthetic values from fragments. RunEvidence remains schema `1.0.0` with the same object shape; fixed codes and correlations are additive only.

The security-assurance model permits bounded summaries and evidence references, rejects sensitive text, and enforces canonical threat order. It never stores attack payloads, matched values, cookies, subjects, digests, usernames, hostnames, machine paths, raw errors, provider responses, environment values, or receipt content.

The AO-007 ignored local receipt validates the earlier live local-provider boundary only. It was hash-checked but not opened or regenerated for AO-010 and does not independently validate these prompt, leakage, or rate controls.

## Deterministic reproduction

Run without provider variables or live scripts:

```text
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run schema:check
npm run security:secrets
npm run security:audit
npm run build
npm run test:e2e
git diff --check
```

The browser suite has seven provider-disabled baseline scenarios and two governed deterministic-fixture scenarios. Normal fixture counts are tags `1`, version `1`, chat `1`, and unexpected `0`. The AO-010 browser scenario makes zero model-generation requests. Deterministic fixture evidence is not live-provider evidence.

## Residual findings

| Finding | Severity | Status | Rationale |
|---|---|---|---|
| Semantic prompt-injection variants can evade deterministic pattern rules. | Medium | `residual_accepted` | Trusted/untrusted separation, no tools, one generation, output controls, and fixed tests bound impact; semantic detection is not claimed complete. |
| Full production DLP and managed secret infrastructure are absent. | Medium | `residual_accepted` | Positive allowlists, boolean detection, output/export blocking, redaction, scanning, and synthetic canaries protect the MVP path. |
| Rate and concurrency state is process-local. | Medium | `residual_accepted` | The judge deployment is single process; distributed quotas and availability infrastructure are outside MVP scope. |
| A nonce-aware production CSP is not configured. | Low | `residual_accepted` | Existing headers and same-origin boundaries remain; CSP needs deployment-specific design and testing. |

Automated checks reduce known judge-path risk but do not establish factual correctness, universal prompt-injection resistance, legal compliance, certification, human security review, or a signed attestation.
