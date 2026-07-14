# ADR-003: Versioned Workflow JSON

- **Status:** Accepted
- **Date:** 2026-07-13

## Context

Visual designs need a portable, testable, exportable source of truth that can evolve without silently changing semantics.

## Decision

Represent architectures as validated JSON with an explicit schema version, stable node and edge identifiers, node implementation status, configuration, policy metadata, and migration rules. Zod validates all reads and writes.

## AO-003 implementation

AO-003 implements the accepted decision without changing it:

- `src/domain/workflow/workflow-schema.ts` is the canonical strict Zod `1.0.0` contract. Supported nodes are a discriminated union, and unknown root, node, configuration, edge, policy, evaluation, and deployment properties are rejected.
- `src/domain/workflow/workflow-types.ts` infers the TypeScript domain model from Zod; `src/domain/workflow/index.ts` exposes the framework-independent contract entry points.
- `src/domain/workflow/workflow-parser.ts` keeps structural parsing and deterministic serialization together while preserving validation paths and refusing coercion or unknown-field stripping.
- `src/domain/workflow/workflow-validator.ts` separately enforces cross-node graph, port, reachability, runtime-integrity, security-reference, and secret-value rules.
- `src/domain/workflow/workflow-migrations.ts` accepts and revalidates `1.0.0`, rejects unsupported historical versions, and tells callers to upgrade for unknown future versions. No fictional pre-1.0 migration exists.
- `src/domain/workflow/workflow-json-schema.ts` uses Zod's native JSON Schema conversion to produce the committed Draft 2020-12 artifact at `schemas/workflow.v1.schema.json`. A deterministic drift check protects the artifact.
- `templates/enterprise-rag.v1.json` is the sole approved MVP template. Its executable RAG topology is explicit, and its read-only relational-database component is simulated and advisory rather than part of runtime traversal.

The contract is framework-independent. AO-003 does not implement a canvas, authentication, persistence, OpenAI calls, retrieval, evaluation execution, diagnostics, or exports.

## Consequences

Workflows become diffable and reproducible. Schema evolution requires fixtures, migrations, compatibility policy, and rejection of unknown unsafe behavior.
