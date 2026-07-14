# ADR-003: Versioned Workflow JSON

- **Status:** Accepted
- **Date:** 2026-07-13

## Context

Visual designs need a portable, testable, exportable source of truth that can evolve without silently changing semantics.

## Decision

Represent architectures as validated JSON with an explicit schema version, stable node and edge identifiers, node implementation status, configuration, policy metadata, and migration rules. Zod validates all reads and writes.

## Consequences

Workflows become diffable and reproducible. Schema evolution requires fixtures, migrations, compatibility policy, and rejection of unknown unsafe behavior.
