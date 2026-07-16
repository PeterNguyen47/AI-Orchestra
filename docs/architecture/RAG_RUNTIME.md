# Governed RAG Runtime

AO-007 parses unknown browser workflow input and runs `assessCanonicalWorkflowExecutionReadiness` before retrieval or model activity. The pure plan requires the existing eight executable stages and seven runtime edges; the simulated relational database remains advisory and is recorded as not opened or queried.

Execution order is input guardrail, deterministic bounded bundled-corpus retrieval, one structured local generation request, output protection, and mechanical citation/relevance/structure evaluation. One authenticated subject may have one active run; global concurrency is process-local. There are no tools, handoffs, persistence, remote tracing, retries, or thinking output.

The canonical target is native Ollama `qwen3:4b` over a validated HTTP loopback URL. Metadata checks confirm runtime version, installed model, and digest when available before the single generation request. Output is reparsed through the provider-neutral Zod schema. Usage normalizes `prompt_eval_count` and `eval_count`; `total_duration` is milliseconds; external API cost is zero and local compute cost is not measured.

Failures expose stable safe codes for disabled execution, unavailable runtime, missing model, timeout, HTTP failure, conflicting identity, unexpected tool call, malformed JSON, and schema-invalid output. Raw provider bodies, prompts, retrieved text, answers, thinking, credentials, and session identifiers are not logged or persisted.
