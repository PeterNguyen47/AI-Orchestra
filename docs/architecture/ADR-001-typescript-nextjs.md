# ADR-001: TypeScript and Next.js

- **Status:** Accepted
- **Date:** 2026-07-13

## Context

The eight-day MVP needs a coherent browser and server experience, shared contracts, fast iteration, and a judge-friendly local setup.

## Decision

Use TypeScript in strict mode with Next.js and React. Keep privileged operations and model calls in server-only modules. Use Zod at runtime boundaries.

## Consequences

One language and deployable reduce coordination cost. Strict typing and runtime validation improve workflow safety. Framework coupling is accepted for the MVP; tests must protect server/client boundaries.

## Implementation

AO-002 implements this decision with Next.js 16.2.10, React 19.2.7, TypeScript 5.9.3 in strict mode, and Zod 4.4.3. Node.js 24.17 LTS is pinned for CI and containers. Environment access and logging are isolated in `server-only` modules.
