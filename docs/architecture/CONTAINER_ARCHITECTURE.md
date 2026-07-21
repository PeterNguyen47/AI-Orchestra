# Container Architecture

**Status:** AO-010 hardens the existing single Next.js judge-path deployable. Model calls and privileged runtime behavior remain server-side; no new deployable, provider, upload, connector, database, or persistence service is introduced.

```mermaid
flowchart TB
    subgraph Browser["Untrusted browser"]
      UI["Next.js React product shell - executable"]
      Canvas["Architecture canvas - executable"]
      BrowserExport["Bounded JSON and Markdown generation - executable"]
      Artifacts["Client-session downloads - executable"]
    end
    subgraph Server["Trusted application boundary"]
      API["Next.js health route - executable"]
      Foundation["Server config and JSON logger - executable"]
      Validator["Zod workflow validator - executable"]
      Runtime["Bounded orchestration runtime - executable"]
      Guardrails["Input/output guardrails - executable"]
      Eval["Evaluation and diagnostics - executable"]
    end
    DB[("SQLite - roadmap")]
    OA["OpenAI Responses API / Agents SDK - roadmap"]
    Docs["Seeded knowledge source - executable"]
    CRM["CRM connector - simulated"]

    UI --> API
    API --> Foundation
    Canvas --> API
    API --> Validator --> Runtime
    Runtime --> Guardrails
    Runtime --> Docs
    Runtime --> OA
    Runtime -.-> CRM
    Runtime --> Eval
    UI --> BrowserExport --> Artifacts
    API --> DB
```

## Deployment shape

The implemented foundation is one standalone Next.js container packaged with Docker Compose. It runs as a non-root user with a read-only filesystem, dropped capabilities, bounded temporary cache, and health check. The UI and server share one codebase while `server-only` modules enforce the environment/logging boundary. Structured JSON logs recursively redact sensitive keys.

SQLite and its documented PostgreSQL migration path remain planned. Neither database is required for the foundation runtime.

AO-009 does not add a server-side export service, route, action, database, registry, or persistence layer. The untrusted browser receives already bounded workflow and RunEvidence state, creates two validated text artifacts in memory, initiates a download, and revokes the object URL. Export generation cannot invoke the model.

## AO-010 process and network controls

The server action applies authentication, a process-local fixed-window limiter, and strict request-size checks before workflow planning or provider construction. The limiter permits six attempts per subject digest per 60 seconds, holds at most 1,024 entries, prunes expired entries, and fails closed at capacity. It resets with the process and is not a distributed rate or billing service.

The health response allowlists only status, service, version, and timestamp. Existing container controls remain non-root execution, a read-only filesystem, dropped capabilities, a bounded temporary cache, and a loopback health probe. The browser cannot select provider endpoints or credentials. The deterministic fixture binds to `127.0.0.1` on an ephemeral port and accepts only its three fixed paths with a 64 KiB body limit and one chat request.

The existing security headers remain unchanged. A nonce-aware production Content Security Policy remains a documented low residual because it requires deployment-specific Next.js and download testing.
