# Model Provider Strategy

AI Orchestra keeps a provider-neutral core and one governed showcase target. AO-007 resolves the canonical workflow only to `ollama-local/qwen3:4b`, deployed on the local machine through a validated HTTP loopback endpoint. There is no fallback, silent model substitution, arbitrary provider support, or browser provider/model/endpoint selection.

The core depends on `ModelExecutionAdapter`, `ModelRuntimeRequest`, `ModelRuntimeResult`, `ResolvedModelTarget`, and `ModelAdapterRegistry`. Retrieval, readiness, guardrails, citations, evaluation, limits, concurrency, logging, and UI contain no provider SDK types.

Registered targets are:

- `ollama-local/qwen3:4b`: executable canonical showcase, Apache-2.0 open-weight, local machine.
- `openai-responses/gpt-5.6`: real optional future hosted adapter, disabled by default, not an AO-007 gate.
- `deterministic-test/ao007-fixture-model`: test-only and inaccessible from production browser requests.

Additional local or hosted providers require separate issues covering license and commercial terms, provenance and digest, model card, safety and injection testing, limits, deployment boundary, retention, quantization/runtime inventory, cost/latency, and human approval.
