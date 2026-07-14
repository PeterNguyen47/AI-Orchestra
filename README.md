# AI Orchestra

AI Orchestra is a low-code, governance-first AI architecture composer for designing, validating, testing, explaining, monitoring, and exporting deployable AI system blueprints.

**Status:** Application foundation and workflow contract

**OpenAI Build Week track:** Developer Tools

**Submission deadline:** July 21, 2026 at 8:00 PM Eastern (5:00 PM Pacific)

## Hackathon MVP

The MVP is one complete Enterprise RAG question-and-answer architecture: user input, input guardrail, knowledge source, retrieval, GPT-5.6 agent, output guardrail, evaluation, and response output. A realistic CRM or relational-database node will be included as an explicitly simulated component.

Nodes will be visibly classified as:

- **Executable:** runs in the end-to-end path.
- **Simulated:** uses a realistic schema but does not call a live enterprise system.
- **Roadmap:** communicates future direction and is not part of the MVP execution claim.

## Technology status

The application foundation uses TypeScript, Next.js, React, Zod, Docker Compose, GitHub Actions, and structured JSON logging. AO-003 adds a strict, versioned `1.0.0` workflow contract that is independent of React and Next.js, a deterministic Draft 2020-12 JSON Schema artifact, and the only approved MVP template: Enterprise RAG question-and-answer.

The template declares the approved runtime topology and marks its relational-database integration as simulated and advisory. AO-003 validates and serializes architecture definitions; it does not execute retrieval, evaluation, model, database, or guardrail behavior. The visual canvas, authentication, OpenAI Responses API and Agents SDK integration, persistence, execution diagnostics, and exports remain planned under later bounded issues.

## Workflow contract

- [Workflow schema](docs/architecture/WORKFLOW_SCHEMA.md) documents the root contract, strict node configurations, edge and port rules, policy, evaluation, deployment, and the structural/semantic validation boundary.
- [Component model](docs/architecture/COMPONENT_MODEL.md) defines the nine supported node types and their implementation-status claims.
- [Migration policy](docs/architecture/WORKFLOW_MIGRATION_POLICY.md) defines current-version validation and fail-closed handling for unsupported historical and future versions.
- [`schemas/workflow.v1.schema.json`](schemas/workflow.v1.schema.json) is generated from the canonical Zod schema and protected by a deterministic drift check.
- [`templates/enterprise-rag.v1.json`](templates/enterprise-rag.v1.json) is the seeded Enterprise RAG architecture, including a read-only simulated relational-database node connected to retrieval by an advisory edge.

## Documentation

- [Product directive](docs/product/PROJECT_DIRECTIVE.md)
- [MVP scope](docs/product/MVP_SCOPE.md)
- [Delivery governance](docs/project-management/DELIVERY_GOVERNANCE.md)
- [Architecture](docs/architecture/SYSTEM_CONTEXT.md)
- [Threat model](docs/security/THREAT_MODEL.md)
- [Test strategy](docs/testing/TEST_STRATEGY.md)
- [Submission checklist](docs/submission/SUBMISSION_CHECKLIST.md)
- [Security policy](SECURITY.md)

## Supported platforms

- Windows, macOS, or Linux.
- Node.js 24.17 LTS is the pinned CI and container runtime. Node.js 26 is accepted for local contribution.
- npm 11.
- Docker Engine with the Docker Compose plugin for the container path.

## Local setup

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. Runtime configuration has safe defaults; no OpenAI key, session secret, or database is required for the AO-002 foundation.

To provide local settings, copy `.env.example` to `.env.local` and replace placeholders only when a later bounded issue requires them. Never commit `.env.local`.

## Quality commands

| Command | Purpose |
|---|---|
| `npm run format:check` | Check formatting for application, automation, workflow-source, and template files. |
| `npm run lint` | Run the Next.js and TypeScript ESLint rules. |
| `npm run typecheck` | Run strict TypeScript without emitting files. |
| `npm run schema:generate` | Regenerate the committed Draft 2020-12 workflow JSON Schema from Zod. |
| `npm run schema:check` | Fail when the committed workflow JSON Schema drifts from the Zod source. |
| `npm test` | Run foundation and workflow-contract unit tests. |
| `npm run test:coverage` | Run unit tests and enforce coverage thresholds. |
| `npm run security:secrets` | Scan committed text for common credential patterns. |
| `npm run security:audit` | Audit all locked dependencies at the moderate-severity gate. |
| `npm run build` | Produce the optimized standalone Next.js build. |

## Production and health check

```bash
npm run build
npm run start
```

The application shell is available at <http://localhost:3000>. The non-cached runtime health endpoint is <http://localhost:3000/api/health>.

## Docker Compose

```bash
docker compose up --build --detach
docker compose ps
docker compose logs --no-color
docker compose down --volumes --remove-orphans
```

The container runs as a non-root user with a read-only filesystem, dropped Linux capabilities, a bounded temporary cache, and an HTTP health check. GitHub Actions builds the image, starts it through Compose, checks the page and health endpoint, verifies a structured health log, and tears it down.

## Foundation and contract judge path

1. Run `npm ci`.
2. Run the quality commands above, including the workflow-schema drift check.
3. Start with npm or Docker Compose.
4. Open the application shell and `/api/health`.

This path verifies the platform foundation and the AO-003 workflow contract/template tests. Authentication, visual workflow composition, persistence, RAG execution, live guardrails, evaluation execution, diagnostics, and exports are not yet implemented.

## Security

Do not report vulnerabilities publicly. Follow [SECURITY.md](SECURITY.md). Never commit secrets; `.env.example` contains placeholders only.

## License

Licensed under the [Apache License 2.0](LICENSE).
