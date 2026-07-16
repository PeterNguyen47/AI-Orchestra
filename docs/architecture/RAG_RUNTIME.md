# Governed RAG Runtime

AO-007 compiles unknown browser workflow input through the canonical parser and server-side execution-readiness gate. The pure plan requires exactly one executable node for each approved Enterprise RAG stage and all required runtime edges. Advisory edges and simulated/roadmap nodes are excluded; the relational database is recorded as not opened or queried.

Execution order is input guardrail, deterministic bundled-corpus retrieval, one structured model request, output protection, and mechanical citation/relevance/structure checks. One authenticated subject may have one active run, global concurrency is process-local, paid calls are never retried, and limiter state is released in `finally`.

Failures return stable safe codes. Questions, retrieved passages, model answers, raw responses, raw errors, credentials, and reasoning are not logged or persisted. Results expose only validated answer text/citations, normalized usage, estimated cost, duration, and minimal control outcomes.
