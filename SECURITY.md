# Security Policy

AI Orchestra is a hackathon prototype, not a production-certified system. Report suspected vulnerabilities privately through GitHub security reporting or another trusted channel; never post live secrets.

## AO-007 local runtime boundary

All model activity is server-side. The canonical runtime is native Ollama `qwen3:4b` over a validated HTTP loopback URL. Only `localhost`, `127.0.0.1`, and canonical IPv6 loopback are accepted. Credentials, query strings, fragments, arbitrary paths, HTTPS endpoints, remote addresses, browser endpoint editing, provider selection, and model selection are rejected.

No OpenAI key is required for build, startup, deterministic tests, Docker, or local execution. The optional GPT-5.6 adapter is disabled by default. Input screening runs before retrieval/model activity; retrieval is deterministic and bounded; output is schema-validated, citation-allowlisted, and checked for executable markup and likely sensitive values. There are no tools, handoffs, persistence, database access, remote tracing, retry, or thinking output.

Questions, retrieved content, answers, raw provider bodies/errors, prompts, reasoning, credentials, receipts, and session identifiers are not logged or persisted. The ignored local receipt contains only allowlisted metadata and must never be committed or pasted. External API cost is zero; local compute/electricity cost is not measured.

## Prototype limitations

The demo identity is local and single-subject; concurrency is process-local. Production DLP, distributed rate limiting, tenant isolation, connector hardening, retention, audit immutability, incident response, and compliance certification remain roadmap work.

## AO-010 judge-path hardening

AO-010 adds deterministic NFKC and separator-aware input screening, trusted-instruction and untrusted-retrieval separation, a synthetic instruction canary, shared boolean-only sensitive-text detection, value-based log redaction, and fixed safe error handling. Unsupported upload-mode workflows fail readiness; no upload or live connector surface exists. Tools and handoffs remain disabled, and the simulated relational database remains unopened and unqueried.

Authenticated action attempts are limited to six per subject digest in a 60-second fixed window. The seventh attempt fails closed with bounded retry metadata before workflow serialization, provider construction, or side effects. The limiter stores no raw subject and is capped at 1,024 process-local entries. It resets on restart and is not a distributed production quota. Questions above 8,000 characters and serialized workflows above 1,000,000 UTF-8 bytes fail before execution; the canonical input guardrail remains 4,000 characters.

The demo uses one logical identity, not a tenant model. Cookies remain HTTP-only, SameSite Lax, path scoped, time bounded, and secure in production. Logout deletes the browser cookie but is not global token revocation. Automated adversarial checks do not constitute a penetration test, certification, security approval, production-readiness statement, or zero-risk claim. See `docs/security/AO010_SECURITY_TEST_REPORT.md` for the ten-threat matrix and residual risks.

## AO-011 portable judge boundary

Portable judge mode explicitly selects `deterministic-test/ao011-judge-fixture` with deployment mode `test_only`. The in-process adapter performs no fetch, socket, filesystem, child-process, provider, tool, handoff, or database operation and is visibly labeled as provider-free infrastructure, not Ollama or live inference. The optional native Ollama path remains separate, loopback-only, and has no silent fallback.

Credential bootstrap runs as non-root with no network and writes random local demonstration authentication to one removable Compose volume. The completion marker is written last; app/readiness mounts are read-only; the session secret and password hash are never printed. The app remains non-root, read-only, capability-dropped, `no-new-privileges`, and limited to bounded tmpfs caches. Internal readiness emits one fixed code and adds no public diagnostic endpoint. These controls are local judge-path safeguards, not managed secrets, multi-tenant isolation, production deployment, or certification.
