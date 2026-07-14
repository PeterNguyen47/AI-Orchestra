# ADR-004: Responses API and Agents SDK

- **Status:** Accepted
- **Date:** 2026-07-13

## Context

The MVP must visibly and meaningfully use GPT-5.6 while keeping execution governed, observable, and server-side.

## Decision

Use the OpenAI Responses API for GPT-5.6 execution and the OpenAI Agents SDK where its tracing or bounded orchestration primitives add value. Wrap provider calls behind a server-side adapter with explicit timeouts, token/cost limits, structured results, and test doubles.

## Consequences

The MVP aligns with the hackathon and gains current platform primitives. Provider behavior, cost, and availability remain risks; no browser-held key or unrestricted tool execution is allowed.
