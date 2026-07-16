# MVP Scope

## Must

AO-007 implements the governed Enterprise RAG execution path with GPT-5.6 as the current reference provider behind provider-neutral server contracts. Governed open-model adapters remain future work and are not claimed as executable.

- Seeded demonstration login and navigation.
- Default dashboard with expandable cards.
- Enterprise RAG template and visual orchestrator canvas.
- Configurable user input, input guardrail, knowledge source, retrieval, GPT-5.6 agent, output guardrail, evaluation, and response-output nodes.
- One visibly simulated CRM or relational-database node with a realistic configuration schema.
- Node status labels: `executable`, `simulated`, and `roadmap`.
- Architecture validation, end-to-end GPT-5.6 RAG execution, guardrail/evaluation results, and execution diagnostics.
- Architecture and assurance exports.
- Docker-based local startup, repository documentation, and judge setup/test instructions.

## Should

- Clear validation guidance and failure recovery.
- Structured JSON logging and useful execution timing.
- SQLite persistence with a documented PostgreSQL migration path.
- Accessible, coherent desktop experience.

## Could

- Movable dashboard cards.
- Persisted dashboard layouts.
- Additional presentation polish after the vertical slice is stable.

## Will Not

- Production enterprise identity or compliance certification.
- Fully functional connectors for every enterprise platform.
- Multi-cloud deployment automation, Kubernetes operators, or complete on-premises support.
- Unrestricted arbitrary tool execution, connector marketplace, billing, complex multi-tenancy, mobile apps, or a full multi-agent forecasting platform.
- Multiple executable templates or advanced automated architecture optimization during the MVP.
