# AI Orchestra

AI Orchestra is a low-code, governance-first composer for designing, validating, and executing governed AI system blueprints.

**Status:** AO-009 deterministic workflow JSON and architecture-assurance Markdown downloads are implemented on the governed AO-007/AO-008 Enterprise RAG surface.

## Executable showcase

The canonical Enterprise RAG workflow has eight executable nodes: user input, input guardrail, bundled document source, deterministic retrieval, Qwen3 4B answer agent, output guardrail, evaluator, and cited response. Its relational-database node is visibly `simulated`, advisory, and never opened or queried. Persistence, remote tracing, tools, and handoffs remain disabled.

The only governed showcase target is native local Ollama with `qwen3:4b`. The endpoint is server-only and restricted to HTTP loopback. There is no browser provider/model/endpoint selector, no silent fallback, and no OpenAI key requirement. The preserved `openai-responses/gpt-5.6` adapter is an optional disabled future integration.

Every outcome includes strict in-memory `RunEvidence 1.0.0`: one opaque run ID, nine ordered stage outcomes, fixed diagnostics, explicit guardrail and aggregate retrieval decisions, bounded target/observed model facts, three deterministic evaluator results, reconciled token/cost metrics, and fixed security-control facts. The protected UI keeps the approved answer and citations separate from diagnostics. Structured logs receive only a fixed safe projection, never the full evidence object.

AO-009 adds exactly two deterministic client-session downloads: a complete Workflow `1.0.0` JSON envelope and a human-readable architecture-assurance Markdown artifact. Canonical workflow bytes are key-sorted with array order preserved and fingerprinted with browser Web Crypto SHA-256. Assurance binds one validated RunEvidence result to the exact submitted workflow snapshot; a missing or stale binding blocks download. Unsafe workflow values fail closed before Blob creation. Artifact text is neither persisted nor logged, and browser object URLs are revoked immediately after download initiation. See [export contracts](docs/architecture/EXPORT_CONTRACTS.md).

The evaluators report citation coverage, rounded lexical retrieval relevance, and schema/citation structure. They do not establish factual truth, semantic correctness, legal compliance, certification, or human review. Total-run duration spans planning through finalization; provider duration is separate when supplied.

## How GPT-5.6 and Codex were used

GPT-5.6 materially supported architecture, governance, acceptance criteria, threat analysis, provider strategy, test strategy, roadmap decisions, and submission planning. Codex implemented and tested the provider-neutral runtime, adapters, guardrails, retrieval, citations, security controls, accessibility, CI integration, documentation, and PR workflow. Qwen3 4B—not GPT-5.6—powers the demonstrated local inference. See [GPT-5.6 evidence](docs/submission/GPT56_USAGE_EVIDENCE.md) and [Codex evidence](docs/submission/CODEX_USAGE.md).

## Requirements

- Windows, macOS, or Linux.
- Node.js 24.17 LTS (Node 26 is accepted locally) and npm 11.
- Native [Ollama](https://ollama.com/) only for the live local gate.
- The single governed model artifact `qwen3:4b` only.

No model or runtime is installed automatically.

## Application setup

```powershell
npm ci
npm run demo:setup
npm run dev
```

Open <http://localhost:3000> and sign in with the ignored `.demo-credentials.txt` values. The setup script writes only ignored local authentication files.

## Native Windows local-model setup

Install Ollama manually from its official installer, then run:

```powershell
ollama pull qwen3:4b
ollama list
$env:AI_ORCHESTRA_LOCAL_EXECUTION_ENABLED="true"
$env:OLLAMA_BASE_URL="http://127.0.0.1:11434"
$env:AI_ORCHESTRA_LOCAL_MODEL="qwen3:4b"
npm run test:live:ao007
```

Ollama must respond on the validated loopback URL. `localhost`, `127.0.0.1`, and canonical IPv6 loopback are accepted; HTTPS, remote hosts, credentials, query strings, fragments, and paths are rejected. Do not substitute `qwen3:1.7b` or another model.

The live command performs metadata checks and exactly one generation request using the committed workflow and synthetic corpus. It writes a sanitized receipt to ignored `test-results/ao007-local-model-receipt.json`. Never commit or paste that receipt. External API cost is `$0.00`; local hardware and electricity costs are not measured.

## Quality commands

| Command | Purpose |
|---|---|
| `npm run format:check` | Formatting check |
| `npm run lint` | ESLint |
| `npm run typecheck` | Strict TypeScript |
| `npm test` | Deterministic unit/integration suite; no Ollama required |
| `npm run test:coverage` | Coverage gates |
| `npm run schema:check` | Generated workflow schema drift |
| `npm run security:secrets` | Secret scan |
| `npm run security:audit` | Moderate dependency audit |
| `npm run build` | Production build |
| `npm run test:e2e` | Authenticated responsive and accessibility browser suite |
| `npm run test:live:ao007` | Required local Ollama/Qwen3 gate |
| `npm run test:live:ao007:openai` | Optional future GPT-5.6 gate; not required or run for AO-007 |

Hosted CI uses deterministic mocked transport plus one bounded `127.0.0.1` AO-008/AO-009 browser-fixture lifecycle. Export checks add no model request. CI never installs Ollama, downloads model artifacts, or contacts OpenAI. The fixture is test infrastructure and does not replace the separate AO-007 live Ollama receipt.

## Documentation

- [Open-model decision](docs/architecture/OPEN_MODEL_DEPLOYMENT_DECISION.md)
- [Provider strategy](docs/architecture/MODEL_PROVIDER_STRATEGY.md)
- [RAG runtime](docs/architecture/RAG_RUNTIME.md)
- [Export contracts](docs/architecture/EXPORT_CONTRACTS.md)
- [Workflow schema](docs/architecture/WORKFLOW_SCHEMA.md)
- [Threat model](docs/security/THREAT_MODEL.md)
- [Test strategy](docs/testing/TEST_STRATEGY.md)
- [Demo script](docs/submission/DEMO_SCRIPT.md)

## Security and license

Never commit credentials, session values, prompts, responses, model artifacts, receipts, or machine-specific paths. Follow [SECURITY.md](SECURITY.md). AI Orchestra is licensed under [Apache-2.0](LICENSE); model licensing and provenance are verified separately.
