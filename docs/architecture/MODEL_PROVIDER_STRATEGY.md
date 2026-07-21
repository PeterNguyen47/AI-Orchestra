# Model Provider Strategy

AI Orchestra keeps a provider-neutral core and two explicit, non-fallback execution modes. Optional live mode resolves the canonical workflow to `ollama-local/qwen3:4b` on a validated HTTP loopback endpoint. Portable judge mode explicitly supplies `deterministic-test/ao011-judge-fixture` as a provider-free `test_only` generation-boundary substitute. It is not Ollama or live inference. There is no fallback, silent model substitution, arbitrary provider support, or browser provider/model/endpoint selection.

The core depends on `ModelExecutionAdapter`, `ModelRuntimeRequest`, `ModelRuntimeResult`, `ResolvedModelTarget`, and `ModelAdapterRegistry`. Retrieval, readiness, guardrails, citations, evaluation, limits, concurrency, logging, and UI contain no provider SDK types.

Registered targets are:

- `ollama-local/qwen3:4b`: executable canonical showcase, Apache-2.0 open-weight, local machine.
- `openai-responses/gpt-5.6`: real optional future hosted adapter, disabled by default, not an AO-007 gate.
- `deterministic-test/ao007-fixture-model`: test-only and inaccessible from production browser requests.
- `deterministic-test/ao011-judge-fixture`: explicit server-only portable-judge target, in-process, provider-free, and `test_only`.

`AI_ORCHESTRA_EXECUTION_MODE` selects `disabled`, `ollama_local`, or `judge_fixture`. Legacy `AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED=true` continues to select `ollama_local` only when the new variable is absent. Contradictory judge/Ollama/OpenAI configuration fails closed. The governed server action constructs exactly one selected adapter and never constructs or falls back to OpenAI.

Additional local or hosted providers require separate issues covering license and commercial terms, provenance and digest, model card, safety and injection testing, limits, deployment boundary, retention, quantization/runtime inventory, cost/latency, and human approval.
