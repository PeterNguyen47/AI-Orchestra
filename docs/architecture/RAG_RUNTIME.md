# Governed RAG Runtime

AO-007 parses unknown browser workflow input and runs `assessCanonicalWorkflowExecutionReadiness` before retrieval or model activity. The pure plan requires the existing eight executable stages and seven runtime edges; the simulated relational database remains advisory and is never opened or queried.

Execution order is input guardrail, deterministic bounded bundled-corpus retrieval, one structured local generation request, output protection, and deterministic evaluation. One authenticated subject may have one active run; global concurrency is process-local. There are no tools, handoffs, persistence, remote tracing, retries, or thinking output.

The canonical target is native Ollama `qwen3:4b` over a validated HTTP loopback URL. Metadata checks confirm runtime version, installed model, and digest when available before the single generation request. Output is reparsed through the provider-neutral Zod schema. Usage reconciles input plus output tokens to the total; external API cost is zero and local compute cost is not measured.

## RunEvidence 1.0.0

AO-008 adds one strict, provider-neutral `RunEvidence` object to every governed result. Evidence is assembled on the server, validated before return, and retained only in memory. Each run receives an opaque `run_<uuid>` identifier and no timestamp. Canonical JSON serialization sorts object keys while preserving array order, so serializing the same evidence object is reproducible; different runs intentionally differ because their run identifiers are unique.

Every outcome contains exactly nine ordered entries: user input, input guardrail, document source, retrieval, GPT agent, output guardrail, evaluator, response output, and simulated relational database. Outcomes are limited to `passed`, `blocked`, `failed`, `simulated`, `skipped`, and `not-started`. Completed stages remain recorded when a later stage stops. The database entry is only `simulated` after a valid plan or `skipped` before one, and always states that no connection was opened or queried.

Fixed diagnostic codes map to fixed explanations. Input decisions record only character counts, configured limits, and policy results. Retrieval records only requested and returned counts, configured bounds, and rounded aggregate lexical relevance. Model evidence keeps configured target identity separate from bounded observed metadata. Output decisions record schema, citation, active-content, sensitive-data, and insufficient-context results without answer content.

The deterministic evaluators are `citation_coverage.v1`, `retrieval_relevance.v1`, and `structural_grounding.v1`. They use only validated citation structure, rounded lexical retrieval values, and schema/citation-structure outcomes. They do not establish factual truth, semantic correctness, legal compliance, certification, or human review.

Total-run duration begins before plan compilation. Provider duration remains a separate optional measurement and the legacy `durationMs` behavior is unchanged. Evidence reconciles input, output, and total tokens, preserves bounded estimated and external API costs, and keeps `localComputeCostMeasured` false.

Structured logs receive a separate fixed-field projection rather than the evidence object. The projection allowlists status, code, run ID, stage outcomes, bounded durations, reconciled usage and costs, evaluator statuses, bounded provider/model identifiers, and security-control facts. Questions, answers, citations, source titles, passages, prompts, provider bodies, raw errors, credentials, cookies, sessions, environment values, paths, host/user identity, stack traces, and thinking content are excluded.

Deterministic CI and browser tests use a bounded loopback HTTP fixture, not native Ollama and not OpenAI. The separate ignored AO-007 local receipt remains the live Ollama evidence and is not replaced by fixture results.

## AO-009 assurance binding

Before the governed server action is awaited, the client synchronously parses the current workflow and captures its canonical key-sorted bytes. A returned result creates an assurance binding only after its RunEvidence passes the unchanged `runEvidenceSchema`. The binding stores only the validated evidence, submitted normalized workflow snapshot, and submitted canonical bytes; approved answer text, questions, and citation titles remain outside it.

Assurance availability compares current canonical bytes directly with the submitted bytes. A missing binding blocks export. Any workflow change makes the prior run stale, including a change made while execution is pending. Restoring byte-identical state re-enables that run without hashing or another model request. SHA-256 is computed only when an artifact is generated. A later validated result replaces the binding, and page reload clears it.

Completed, blocked, failed, busy, and not-configured terminal evidence may support assurance when the submitted workflow remains current. The nine authoritative timeline outcomes, fixed diagnostic explanation, guardrail and retrieval facts, evaluator results, metrics, and security booleans are projected without changing RunEvidence `1.0.0`. The database remains simulated or skipped and is never opened or queried.
