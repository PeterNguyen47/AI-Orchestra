# Container Architecture

**Status:** Planned. AO-002 will establish the first runtime containers.

```mermaid
flowchart TB
    subgraph Browser["Untrusted browser"]
      UI["Next.js React UI - planned"]
      Canvas["Architecture canvas - planned"]
    end
    subgraph Server["Trusted application boundary"]
      API["Next.js server routes - planned"]
      Validator["Zod workflow validator - planned"]
      Runtime["Bounded orchestration runtime - planned"]
      Guardrails["Input/output guardrails - planned"]
      Eval["Evaluation and diagnostics - planned"]
      Export["Export service - planned"]
    end
    DB[("SQLite - planned")]
    OA["OpenAI Responses API / Agents SDK - planned"]
    Docs["Seeded knowledge source - planned"]
    CRM["CRM connector - simulated"]

    UI --> API
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

The MVP is a single deployable web application plus SQLite, packaged for Docker Compose. The UI and server share one codebase but maintain a hard browser/server trust boundary. Structured JSON logs exclude secrets and sensitive content. A documented PostgreSQL migration path is planned; PostgreSQL is not an MVP runtime requirement.
