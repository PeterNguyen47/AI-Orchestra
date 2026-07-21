# Open-Model Deployment Decision

- **Status:** Accepted for AO-007
- **Date:** 2026-07-16
- **Owner:** Repository owner

## Context

The original AO-007 plan required a live hosted GPT-5.6 gate. That gate was unavailable and would make the default showcase depend on a cloud account, API key, and paid inference. The provider-neutral executor, OpenAI adapter, and historical decision evidence remain valuable.

## Decision

Use native local Ollama with the single governed `qwen3:4b` open-weight model as the executable Enterprise RAG reference deployment. The endpoint is server-only, HTTP loopback-only, and fixed by validated environment configuration. The browser cannot select a provider, model, or endpoint. The OpenAI Responses `gpt-5.6` adapter remains a real optional future integration, disabled by default and outside AO-007 acceptance.

## Alternatives considered

- Keep GPT-5.6 mandatory: rejected because the live gate is unavailable and conflicts with the key-free default showcase.
- Substitute a smaller or arbitrary local model: rejected because silent substitution and unrestricted selection are not governed.
- Add an Ollama npm client: rejected because native server-side fetch is sufficient and avoids dependency growth.

## Consequences

The application builds, starts, tests, and demonstrates without an OpenAI key. Local inference has zero external API cost; local hardware and electricity cost are not measured. Ollama and the Qwen3 4B artifact must be installed manually. The model is classified as Apache-2.0 open-weight; release preparation must verify model provenance, digest, and license metadata from the installed runtime. Additional local or hosted models require separate governed issues.

## AO-011 portability addendum

The AO-007 decision remains the optional live local-model architecture. AO-011 adds a separate Docker-first judge mode that requires no model runtime or artifact: the in-process `deterministic-test/ao011-judge-fixture` is `test_only`, provider-free, and substitutes only generation. It must never be described as Ollama, Qwen, an LLM deployment, or live inference. Explicit mode selection and fail-closed contradictions prevent silent fallback. Containerized Ollama, model pulls in hosted CI, OpenAI portability, and production orchestration remain rejected.
