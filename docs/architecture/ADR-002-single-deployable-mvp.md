# ADR-002: Single Deployable MVP

- **Status:** Accepted
- **Date:** 2026-07-13

## Context

Microservices would add deployment, observability, and failure-mode overhead before product value is proven.

## Decision

Ship one Dockerized Next.js deployable with internal modules and SQLite. Preserve clear boundaries so model runtime, validation, persistence, and exports can be extracted later.

## Consequences

Local startup and judging are simpler. Independent scaling is deferred. Module contracts and structured logs are required to avoid an unstructured monolith.
