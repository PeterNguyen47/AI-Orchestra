# MVP Scope

## Must

AO-007 implements the governed Enterprise RAG execution path with native local Ollama `qwen3:4b` as the single showcase reference runtime. The provider-neutral core remains authoritative; the OpenAI Responses `gpt-5.6` adapter is optional, disabled, and not an AO-007 gate.

- Seeded demonstration login, dashboard, canonical visual orchestrator, and configuration/readiness validation.
- Eight executable Enterprise RAG stages with deterministic bounded retrieval, guardrails, structured local-model output, citations, evaluation, and safe execution facts.
- One visibly `simulated` relational-database node that is advisory and never queried.
- Node status labels `executable`, `simulated`, and `roadmap`.
- Key-free default installation and demonstration, loopback-only local endpoint, no browser provider selection, no silent fallback.
- Deterministic CI plus a separate real local Ollama/Qwen3 gate.

## Should

Clear recovery guidance, structured redacted logging, accessible responsive UX, and useful execution timing/token metadata.

## Could

Additional polish after the vertical slice is stable.

## Will Not

Arbitrary model selection, automatic runtime/model installation, unrestricted tools, production connectors, persistence, remote tracing, production identity/compliance, Kubernetes/multi-cloud automation, or AO-008 diagnostics in this issue.
