# AI Orchestra

AI Orchestra is a low-code, governance-first AI architecture composer for designing, validating, testing, explaining, monitoring, and exporting deployable AI system blueprints.

**Status:** Foundation

**OpenAI Build Week track:** Developer Tools

**Submission deadline:** July 21, 2026 at 8:00 PM Eastern (5:00 PM Pacific)

## Hackathon MVP

The MVP is one complete Enterprise RAG question-and-answer architecture: user input, input guardrail, knowledge source, retrieval, GPT-5.6 agent, output guardrail, evaluation, and response output. A realistic CRM or relational-database node will be included as an explicitly simulated component.

Nodes will be visibly classified as:

- **Executable:** runs in the end-to-end path.
- **Simulated:** uses a realistic schema but does not call a live enterprise system.
- **Roadmap:** communicates future direction and is not part of the MVP execution claim.

## Planned stack

TypeScript, Next.js, React, a React-compatible node graph library, OpenAI Responses API, OpenAI Agents SDK, Zod, SQLite with a documented PostgreSQL migration path, Docker Compose, GitHub Actions, and structured JSON logging.

## Documentation

- [Product directive](docs/product/PROJECT_DIRECTIVE.md)
- [MVP scope](docs/product/MVP_SCOPE.md)
- [Delivery governance](docs/project-management/DELIVERY_GOVERNANCE.md)
- [Architecture](docs/architecture/SYSTEM_CONTEXT.md)
- [Threat model](docs/security/THREAT_MODEL.md)
- [Test strategy](docs/testing/TEST_STRATEGY.md)
- [Submission checklist](docs/submission/SUBMISSION_CHECKLIST.md)
- [Security policy](SECURITY.md)

## Setup — Not yet implemented

Application setup, dependencies, and runtime commands will be introduced by AO-002. There is no runnable application in this foundation revision.

## Security

Do not report vulnerabilities publicly. Follow [SECURITY.md](SECURITY.md). Never commit secrets; `.env.example` contains placeholders only.

## License

Licensed under the [Apache License 2.0](LICENSE).
