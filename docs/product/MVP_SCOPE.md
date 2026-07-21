# MVP Scope

## Must

AO-007 implements the governed Enterprise RAG execution path with native local Ollama `qwen3:4b` as the optional live reference runtime. AO-011 adds an explicit provider-free Docker judge mode using `deterministic-test/ao011-judge-fixture` classified `test_only`; it is not Ollama or live inference. The provider-neutral core remains authoritative; the OpenAI Responses `gpt-5.6` adapter is optional, disabled, and not a judge gate.

- Seeded demonstration login, dashboard, canonical visual orchestrator, and configuration/readiness validation.
- Eight executable Enterprise RAG stages with deterministic bounded retrieval, guardrails, structured local-model output, citations, evaluation, and safe execution facts.
- One visibly `simulated` relational-database node that is advisory and never queried.
- Node status labels `executable`, `simulated`, and `roadmap`.
- Docker-first portable judge startup without host Node/npm, Ollama, model artifacts, OpenAI credentials, receipt access, or prior machine state.
- Key-free demonstration, explicit execution modes, loopback-only optional live endpoint, no browser provider selection, and no silent fallback.
- Removable local credential volume, four-field liveness, internal fixed-code readiness, clean-clone rehearsal, and a timed judge path.
- Deterministic CI plus a separate prior real local Ollama/Qwen3 evidence gate.

## Should

Clear recovery guidance, structured redacted logging, accessible responsive UX, and useful execution timing/token metadata.

## Could

Additional polish after the vertical slice is stable.

## Will Not

Arbitrary model selection, automatic runtime/model installation, unrestricted tools, production connectors, persistence, remote tracing, production identity/compliance, Kubernetes/multi-cloud automation, production SRE/HA/DR claims, or AO-012 submission work.
