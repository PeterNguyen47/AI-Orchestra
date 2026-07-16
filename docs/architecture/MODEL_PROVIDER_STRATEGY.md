# Model Provider Strategy

AI Orchestra is open-model-first: organizations should ultimately select governed, appropriately licensed models for their use case, risk, cost, sovereignty, and productivity needs. AO-007 implements GPT-5.6 through OpenAI Responses as one production-shaped reference, not a permanent exclusive model.

The core runtime depends only on `ModelExecutionAdapter`, `ModelRuntimeRequest`, `ModelRuntimeResult`, `ResolvedModelTarget`, and `ModelAdapterRegistry`. Retrieval, planning, guardrails, evaluation, limits, logging, and UI contain no provider SDK types. The server derives the target from the readiness-approved workflow; the browser cannot select it.

The initial registry contains the executable `openai-responses/gpt-5.6` hosted target and a `deterministic-test/ao007-fixture-model` test-only adapter. The deterministic adapter is non-production and cannot be selected from browser input. There is no fallback or model substitution.

## Future open-model governance gate

A future schema version may add a closed, governed target reference without changing the stage contracts. Each adapter will require approved license and commercial terms, source and model provenance, immutable version/checksum, model card, safety and security baseline, prompt-injection/data-exfiltration results, context/output limits, separately approved tool capability, trust zone, residency/retention behavior, quantization/runtime provenance, software/model inventory, cost/latency/infrastructure profile, and human-approval rules for higher-risk use. AO-007 does not implement arbitrary open-model execution.
