# Container Architecture

**Status:** AO-002 implements the application shell, health route, server configuration/logging boundary, and single Docker deployable. Product modules remain planned.

```mermaid
flowchart TB
    subgraph Browser["Untrusted browser"]
      UI["Next.js React foundation shell - executable"]
      Canvas["Architecture canvas - roadmap"]
    end
    subgraph Server["Trusted application boundary"]
      API["Next.js health route - executable"]
      Foundation["Server config and JSON logger - executable"]
      Validator["Zod workflow validator - roadmap"]
      Runtime["Bounded orchestration runtime - roadmap"]
      Guardrails["Input/output guardrails - roadmap"]
      Eval["Evaluation and diagnostics - roadmap"]
      Export["Export service - roadmap"]
    end
    DB[("SQLite - roadmap")]
    OA["OpenAI Responses API / Agents SDK - roadmap"]
    Docs["Seeded knowledge source - roadmap"]
    CRM["CRM connector - simulated"]

    UI --> API
    API --> Foundation
    Canvas --> API
    API --> Validator --> Runtime
    Runtime --> Guardrails
    Runtime --> Docs
    Runtime --> OA
    Runtime -.-> CRM
    Runtime --> Eval --> Export
    API --> DB
```

## Deployment shape

The implemented foundation is one standalone Next.js container packaged with Docker Compose. It runs as a non-root user with a read-only filesystem, dropped capabilities, bounded temporary cache, and health check. The UI and server share one codebase while `server-only` modules enforce the environment/logging boundary. Structured JSON logs recursively redact sensitive keys.

SQLite and its documented PostgreSQL migration path remain planned. Neither database is required for the foundation runtime.
