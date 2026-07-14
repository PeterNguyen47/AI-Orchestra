# Workflow Schema

## Purpose and authority

The workflow JSON document is the portable source of truth for an AI Orchestra architecture. AO-003 defines schema version `1.0.0` as a strict, JSON-serializable contract that later canvas, validation, execution, migration, diagnostics, and export modules can consume without depending on React, Next.js request types, server-only configuration, or provider SDKs.

The canonical source is `src/domain/workflow/workflow-schema.ts`. TypeScript domain types are inferred from the Zod schemas in `workflow-types.ts`; no parallel handwritten interface is authoritative.

## Validation layers

AI Orchestra deliberately separates two kinds of validation:

1. **Structural parsing** uses strict Zod schemas. It checks the version, required fields, closed enumerations, primitive constraints, node-specific configurations, and unknown properties. It does not coerce values or silently strip data.
2. **Semantic validation** runs only after structural parsing. It resolves graph references, validates port direction and data-contract compatibility, checks runtime/advisory boundaries, proves executable reachability, and applies cross-document security rules.

The generated JSON Schema expresses the portable structural layer. Rules involving multiple nodes, edges, runtime traversal, or likely-secret heuristics remain in `workflow-validator.ts`.

## Root contract

Every `1.0.0` workflow is a strict object with exactly these required properties:

| Property | Contract |
|---|---|
| `schemaVersion` | Exact literal `1.0.0`. Other versions fail closed and are routed through migration policy. |
| `workflowId` | Stable, non-empty workflow identifier. |
| `template` | Strict `id` and semantic `version` metadata. |
| `name` | Human-readable non-empty workflow name. |
| `description` | Human-readable workflow purpose and boundaries. |
| `nodes` | Array of strict discriminated node objects. Node IDs must also be semantically unique. |
| `edges` | Array of strict edge objects. Edge IDs and logical endpoint tuples must also be semantically unique. |
| `policies` | Strict data, tool, human-approval, and execution-limit policy sections. |
| `evaluation` | Strict dataset reference, required metric thresholds, and overall pass threshold. This is configuration, not evaluation execution. |
| `deployment` | Strict `local_docker` profile plus required environment-variable names. It does not provision infrastructure. |
| `metadata` | Strict `owner`, stable `tags`, and `documentationRef` metadata. |

Unknown root properties are errors.

## Closed classifications

| Concern | Allowed values |
|---|---|
| Schema version | `1.0.0` |
| Implementation status | `executable`, `simulated`, `roadmap` |
| Node type | `user_input`, `input_guardrail`, `document_source`, `retrieval`, `gpt_agent`, `output_guardrail`, `evaluator`, `response_output`, `relational_database` |
| Edge mode | `runtime`, `advisory` |
| Data classification | `public`, `internal`, `confidential`, `restricted` |
| Trust zone | `browser`, `application`, `external_service`, `enterprise_system` |
| Deployment profile | `local_docker` |
| Port direction | `input`, `output` |
| Port data contract | `user_query`, `guarded_query`, `document_collection`, `retrieval_context`, `agent_response`, `guarded_response`, `evaluated_response`, `relational_records` |

Unknown values are rejected structurally rather than interpreted as extensions.

## Node contract

Every node requires:

- `id`, `type`, `label`, and `description`;
- machine-readable `implementationStatus`;
- finite `position.x` and `position.y` coordinates for deterministic future-canvas layout;
- a non-empty `ports` array whose members have a stable `id`, `direction`, and `dataContract`;
- a strict, node-type-specific `configuration`;
- `security` metadata containing data classification and trust zone; and
- a repository-relative or logical `documentationRef`.

The node schema is a discriminated union on `type`. Each configuration is a strict object, so a field valid for one node type cannot be smuggled into another. `simulated` and `roadmap` are never normalized to `executable`.

The detailed configuration and seeded-template role of every type are in [COMPONENT_MODEL.md](COMPONENT_MODEL.md).

## Port and edge contract

A port belongs to one node. Its stable `id` is resolved only within that node, `direction` is either input or output, and `dataContract` identifies the payload contract the port accepts or emits. Unknown port properties are rejected.

Every edge is a strict object with these required properties:

| Property | Meaning |
|---|---|
| `id` | Stable edge identifier, unique within the workflow. |
| `sourceNodeId` / `sourcePortId` | Existing source node and its output port. |
| `targetNodeId` / `targetPortId` | Existing target node and its input port. |
| `mode` | `runtime` or `advisory`. |
| `dataContract` | Contract that must be compatible with both endpoint ports. |
| `label` | Human-readable relationship label. |

Semantic validation rejects missing endpoints or ports, wrong directions, self-references, duplicate source-port-to-target-port relationships, and incompatible data contracts. A `runtime` edge may connect only `executable` nodes. An `advisory` edge may document a simulated or roadmap relationship, but it is excluded from runtime traversal and cannot become part of the executable input-to-output path.

## Workflow policies

`policies` contains four required strict sections:

- `dataPolicy` makes the default data classification explicit.
- `toolPolicy` carries an explicit bounded allowlist. The Enterprise RAG template allows no external tools.
- `humanApprovalPolicy.required` records whether approval is required even when the current template sets it to false.
- `executionLimits` defines positive bounded `maximumSteps`, `maximumTotalTokens`, and `maximumEstimatedCostUsd`.

These fields are durable governance configuration. AO-003 validates them but does not enforce a live execution budget or approval flow.

## Evaluation contract

The root `evaluation` configuration requires:

- `requiredMetrics` as a strict fixed object whose `groundedness`, `relevance`, and `citation_coverage` properties are all literal `true`;
- `metricThresholds.groundedness`, `metricThresholds.relevance`, and `metricThresholds.citation_coverage`;
- a numeric threshold from zero through one for every metric;
- an overall pass threshold from zero through one; and
- a repository-relative dataset reference or logical dataset identifier.

The evaluator node also carries the required metrics and thresholds for its place in the graph. AO-003 ensures the configuration is complete and bounded; it does not score outputs or load an evaluation dataset.

## Deployment contract

`deployment.profile` is fixed to `local_docker`, `profileReference` identifies the existing repository-relative Docker deployment profile, and `requiredEnvironmentVariables` contains names only. The schema does not represent Kubernetes, cloud-provider infrastructure, automated provisioning, or duplicated `.env.example` values.

## Parsing and canonical serialization

The safe parser accepts unknown input and returns a structured success or failure result. Successful results contain the canonical inferred workflow type. Failures preserve Zod paths so callers can point to the exact invalid JSON location.

The canonical serializer accepts a validated workflow and emits deterministic, human-reviewable JSON. Parse, serialize, and reparse produce an equivalent current-version workflow. Parsing does not coerce invalid primitives, and neither parsing nor serialization silently discards unknown fields.

Version routing and current-version migration behavior are documented in [WORKFLOW_MIGRATION_POLICY.md](WORKFLOW_MIGRATION_POLICY.md).

## Semantic findings

Semantic validation is deterministic and side-effect free. Every finding has:

- a stable machine-readable `code`;
- `severity`;
- a JSON-style `path`; and
- a human-readable `message`.

The validator covers uniqueness, edge and port resolution, direction, self-reference, duplicate logical edges, data-contract compatibility, runtime-status integrity, advisory-edge exclusion, required input and output nodes, executable input-to-output reachability, disconnected executable nodes, explicit security metadata, environment-variable reference syntax, and likely embedded-secret values.

An architecture is semantically acceptable only when it has no error-severity findings.

## Generated JSON Schema

`src/domain/workflow/workflow-json-schema.ts` converts the canonical Zod schema with Zod 4 native JSON Schema support. The deterministic Draft 2020-12 output at `schemas/workflow.v1.schema.json` uses the stable identifier `https://ai-orchestra.dev/schemas/workflow.v1.schema.json` and carries a title, description, and schema version.

Generation is configured to throw for unrepresentable constructs or cycles. Every generated object branch remains closed with `additionalProperties: false`; generation never weakens strict parsing to obtain an artifact.

- `npm run schema:generate` regenerates the committed artifact.
- `npm run schema:check` generates in memory and fails when the committed artifact differs.

The repository uses a small development-only TypeScript runner so the generator can import the canonical TypeScript schema directly. No second validation or schema-conversion framework is introduced.

## Enterprise RAG template

`templates/enterprise-rag.v1.json` contains the only approved AO-003/MVP template:

- template ID `enterprise-rag-question-answer`;
- template version `1.0.0`; and
- name `Enterprise RAG Question-and-Answer Assistant`.

`user_input -> input_guardrail -> retrieval -> gpt_agent -> output_guardrail -> evaluator -> response_output`

`document_source` also feeds `retrieval` through a runtime edge. A `relational_database` points to `retrieval` through an advisory edge only.

The database node is visibly `simulated`, read-only, configured with an environment-variable reference name, and excluded from runtime traversal. The GPT agent is configured for GPT-5.6 with no external tools; retrieval and output policy require citations; evaluation includes groundedness, relevance, and citation coverage. Positions and fixture metadata are deterministic, with no changing timestamps, private data, or secret values.

The seeded workflow defaults to `confidential` data, permits no tools, requires no human approval, and declares limits of 16 steps, 100,000 total tokens, and USD 10 estimated cost. Evaluation thresholds are 0.80 groundedness, 0.75 relevance, 0.90 citation coverage, and 0.80 overall against logical dataset `enterprise-rag-evaluation-v1`. Deployment references `compose.yaml` under `local_docker` and names `ENTERPRISE_RAG_DATABASE_URL` without storing its value.

## AO-003 exclusions

This contract does not implement a canvas, React workflow editor, API route, authentication, persistence, OpenAI call, workflow executor, document ingestion, retrieval, guardrail execution, evaluation execution, diagnostics UI, or export UI.
