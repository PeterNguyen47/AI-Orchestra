# OpenAI GPT-5.6 Optional Reference Provider

The server-only `openai@6.47.0` and `@openai/agents@0.13.4` adapter is preserved as a real optional future integration. It supports one Responses request, one turn, no tools, no handoffs, no storage, no automatic retry, an AbortSignal, Zod structured output, and disabled remote Agents tracing.

It is disabled by default, is not selected by the canonical AO-007 workflow, and is not an AO-007 acceptance gate. `OPENAI_API_KEY` is unnecessary for build, startup, tests, Docker, or the local Qwen3 demonstration. It is considered configured only when both `AI_ORCHESTRA_OPENAI_EXECUTION_ENABLED=true` and a server-side key exist.

The optional command is `npm run test:live:ao007:openai`. It is not run during the local-model pivot. No OpenAI request is implied by deterministic or local evidence.
