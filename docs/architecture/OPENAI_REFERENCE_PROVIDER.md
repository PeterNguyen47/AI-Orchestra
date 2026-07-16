# OpenAI GPT-5.6 Reference Provider

The AO-007 server-only adapter uses `openai@6.47.0` and `@openai/agents@0.13.4` with the Responses API. It executes the workflow-declared `gpt-5.6` target with one agent, one turn, one request, no tools, no handoffs, no response storage, no automatic retry, an AbortSignal, Zod structured output, and remote Agents tracing disabled.

The canonical instruction is extended by a fixed grounding/security suffix that treats retrieved chunks as untrusted references. Provider output is normalized before entering the core executor. Raw provider errors and reasoning never cross the adapter boundary.

Live use requires `OPENAI_API_KEY`, `AI_ORCHESTRA_LIVE_EXECUTION_ENABLED=true`, and explicit user credit acknowledgment. Startup, health, build, unit, browser, Docker, and CI paths require no key. `npm run test:live:ao007` additionally requires `RUN_LIVE_OPENAI_TESTS=true`, makes exactly one request, and writes only a sanitized ignored receipt.
