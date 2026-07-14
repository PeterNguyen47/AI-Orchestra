# System Context

**Status:** Planned; no application component is implemented as of July 13, 2026.

AI Orchestra lets a builder compose and run a governed AI architecture while preserving understandable validation and assurance evidence.

```mermaid
flowchart LR
    Builder["Builder or judge"] -->|designs and tests| AO["AI Orchestra web application - planned"]
    AO -->|server-side requests| OpenAI["OpenAI Responses API / GPT-5.6 - planned"]
    AO -->|retrieves approved content| Knowledge["Demo knowledge source - planned"]
    AO -->|reads and writes| Store["SQLite persistence - planned"]
    AO -.->|realistic schema; no live call| CRM["CRM / relational database - simulated"]
    AO -->|exports| Artifacts["Architecture and assurance artifacts - planned"]
```

## Trust boundaries

Browser input is untrusted. Model requests, secrets, retrieval, tools, persistence, and policy enforcement stay server-side. Uploaded and retrieved content is data, not authority. The simulated CRM is visibly non-executable.
