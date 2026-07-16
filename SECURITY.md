# Security Policy

AI Orchestra is a hackathon prototype, not a production-certified system. Report suspected vulnerabilities privately through GitHub security reporting or another trusted channel; never post live secrets.

## AO-007 local runtime boundary

All model activity is server-side. The canonical runtime is native Ollama `qwen3:4b` over a validated HTTP loopback URL. Only `localhost`, `127.0.0.1`, and canonical IPv6 loopback are accepted. Credentials, query strings, fragments, arbitrary paths, HTTPS endpoints, remote addresses, browser endpoint editing, provider selection, and model selection are rejected.

No OpenAI key is required for build, startup, deterministic tests, Docker, or local execution. The optional GPT-5.6 adapter is disabled by default. Input screening runs before retrieval/model activity; retrieval is deterministic and bounded; output is schema-validated, citation-allowlisted, and checked for executable markup and likely sensitive values. There are no tools, handoffs, persistence, database access, remote tracing, retry, or thinking output.

Questions, retrieved content, answers, raw provider bodies/errors, prompts, reasoning, credentials, receipts, and session identifiers are not logged or persisted. The ignored local receipt contains only allowlisted metadata and must never be committed or pasted. External API cost is zero; local compute/electricity cost is not measured.

## Prototype limitations

The demo identity is local and single-subject; concurrency is process-local. Production DLP, distributed rate limiting, tenant isolation, connector hardening, retention, audit immutability, incident response, and compliance certification remain roadmap work.
