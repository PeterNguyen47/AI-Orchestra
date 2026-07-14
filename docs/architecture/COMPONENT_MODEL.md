# Workflow Component Model

## Claim boundary

AO-003 defines configuration and graph contracts for nine node types. It does not implement their product behavior.

`implementationStatus` is mandatory:

- `executable` identifies a node allowed on the declared runtime path;
- `simulated` identifies a realistic contract without a live integration; and
- `roadmap` identifies future direction.

Only `executable` nodes may be joined by `runtime` edges. `simulated` and `roadmap` nodes may participate in descriptive `advisory` relationships but cannot enter runtime traversal. The `relational_database` schema is additionally fixed to `simulated` so input JSON cannot claim that connector is executable.

## Common node shape

Every component has a stable lowercase `id`; closed `type`; non-empty `label` and `description`; `implementationStatus`; bounded finite `position` coordinates; one or more strict `ports`; its type-specific strict `configuration`; `security.dataClassification` and `security.trustZone`; and a repository-relative or logical `documentationRef`.

Ports contain only:

- `id`: stable within the owning node;
- `direction`: `input` or `output`; and
- `dataContract`: one of the closed portable payload contracts.

The allowed payload contracts are `user_query`, `guarded_query`, `document_collection`, `retrieval_context`, `agent_response`, `guarded_response`, `evaluated_response`, and `relational_records`. Semantic validation requires an edge's contract to match its declared endpoint contracts.

Every node explicitly declares one of `public`, `internal`, `confidential`, or `restricted` and one of `browser`, `application`, `external_service`, or `enterprise_system`. These fields document the trust boundary for later enforcement; AO-003 does not move or process data.

## Supported components

| Type | Seeded node ID | Seeded status | Seeded ports |
|---|---|---|---|
| `user_input` | `user-input` | `executable` | `question-out`: output `user_query` |
| `input_guardrail` | `input-guardrail` | `executable` | `question-in`: input `user_query`; `guarded-query-out`: output `guarded_query` |
| `document_source` | `document-source` | `executable` | `documents-out`: output `document_collection` |
| `retrieval` | `retrieval` | `executable` | `guarded-query-in`: input `guarded_query`; `documents-in`: input `document_collection`; `relational-records-in`: input `relational_records`; `context-out`: output `retrieval_context` |
| `gpt_agent` | `gpt-agent` | `executable` | `context-in`: input `retrieval_context`; `response-out`: output `agent_response` |
| `output_guardrail` | `output-guardrail` | `executable` | `response-in`: input `agent_response`; `guarded-response-out`: output `guarded_response` |
| `evaluator` | `evaluator` | `executable` | `guarded-response-in`: input `guarded_response`; `evaluated-response-out`: output `evaluated_response` |
| `response_output` | `response-output` | `executable` | `evaluated-response-in`: input `evaluated_response` |
| `relational_database` | `simulated-relational-database` | `simulated` | `records-out`: output `relational_records` |

Seeded security assignments are explicit for every node:

| Seeded node ID | Data classification | Trust zone |
|---|---|---|
| `user-input` | `internal` | `browser` |
| `input-guardrail` | `internal` | `application` |
| `document-source` | `confidential` | `application` |
| `retrieval` | `confidential` | `application` |
| `gpt-agent` | `confidential` | `external_service` |
| `output-guardrail` | `confidential` | `application` |
| `evaluator` | `confidential` | `application` |
| `response-output` | `internal` | `browser` |
| `simulated-relational-database` | `confidential` | `enterprise_system` |

### User input

**Type:** `user_input`.

**Purpose:** Declares the human question entry point.

**Configuration:**

- `inputMode` is fixed to `text`.
- `maximumInputLength` is a positive bounded integer.
- `acceptedContentType` is fixed to `text/plain`.

**Ports and role:** Emits `user_query` from an output port. The Enterprise RAG template marks this node `executable` and places it in the `browser` trust zone as the required start of runtime traversal.

### Input guardrail

**Type:** `input_guardrail`.

**Purpose:** Declares pre-retrieval input-policy requirements.

**Configuration:**

- `promptInjectionDetectionEnabled` is explicit.
- `maximumInputLength` is a positive bounded integer.
- `action` is `block` or `review`.

**Ports and role:** Accepts `user_query` and emits `guarded_query`. The template marks it `executable`. AO-003 validates this declaration but does not detect prompt injection or perform a block/review action.

### Document source

**Type:** `document_source`.

**Purpose:** Declares the approved source of documents used by retrieval.

**Configuration:**

- `sourceMode` is limited to `bundled` or `upload`.
- `allowedMimeTypes` is a bounded non-empty list of lowercase MIME types.
- `maximumFileSizeBytes` is a positive bounded integer.
- `dataClassification` is explicit.

**Ports and role:** Emits `document_collection` to retrieval. The template marks it `executable`. AO-003 does not upload, parse, chunk, store, or ingest documents.

### Retrieval

**Type:** `retrieval`.

**Purpose:** Declares how context should be selected for the agent.

**Configuration:**

- `topK` is an integer from 1 through 100.
- `minimumRelevanceScore` is from 0 through 1.
- `maximumContextCharacters` is a positive bounded integer.
- `citationsRequired` is explicit and true in the Enterprise RAG template.

**Ports and role:** Accepts `guarded_query` and `document_collection` on runtime inputs, emits `retrieval_context`, and may expose a separate `relational_records` input for the advisory simulated-database relationship. The template marks retrieval `executable`. AO-003 performs no search, ranking, embedding, vector lookup, context assembly, or citation generation.

### GPT agent

**Type:** `gpt_agent`.

**Purpose:** Declares the model and governed response-generation settings.

**Configuration:**

- `model` is fixed by this contract to `gpt-5.6`.
- `systemInstruction` is a bounded non-empty instruction.
- `reasoningEffort` is `low`, `medium`, or `high`.
- `maximumOutputTokens` is a positive bounded integer.
- `allowedTools` is an explicit bounded list of stable tool identifiers and is empty in the template.

**Ports and role:** Accepts `retrieval_context` and emits `agent_response`. The template marks it `executable`. AO-003 adds no OpenAI dependency, API call, Agents SDK orchestration, or tool execution.

### Output guardrail

**Type:** `output_guardrail`.

**Purpose:** Declares post-generation citation, sensitive-data, and unsupported-answer policy.

**Configuration:**

- `citationsRequired` is explicit and true in the template.
- `sensitiveDataPolicy` is `block`, `redact`, or `review`.
- `unsupportedAnswerBehavior` is `decline` or `request_clarification`.

**Ports and role:** Accepts `agent_response` and emits `guarded_response`. The template marks it `executable` and requires grounded citations. AO-003 does not inspect or rewrite generated answers.

### Evaluator

**Type:** `evaluator`.

**Purpose:** Declares acceptance thresholds for the answer produced by the guarded path.

**Configuration:**

- `metricThresholds.groundedness`;
- `metricThresholds.relevance`;
- `metricThresholds.citation_coverage`;
- `requiredMetrics` as a strict object with `groundedness`, `relevance`, and `citation_coverage` all fixed to `true`; and
- `overallPassThreshold`.

Every threshold is from 0 through 1.

**Ports and role:** Accepts `guarded_response` and emits `evaluated_response`. The template marks it `executable`. AO-003 does not calculate metrics, compare a live answer, or execute an evaluation dataset.

### Response output

**Type:** `response_output`.

**Purpose:** Declares the final answer representation.

**Configuration:**

- `outputFormat` is `markdown`, `plain_text`, or `json`.
- `citationRendering` is `inline` or `source_list`.

**Ports and role:** Accepts `evaluated_response`. The template marks it `executable` and uses it as the required end of runtime traversal. AO-003 does not render a user interface or return an API response.

### Relational database (simulated)

**Type:** `relational_database`.

**Purpose:** Declares a realistic enterprise relational-data source while making the non-live boundary unambiguous.

**Configuration:**

- `engineType` is `postgresql`, `mysql`, `sql_server`, or `sqlite`.
- `connectionReference.environmentVariableName` contains an uppercase environment-variable name only.
- `accessMode` is fixed to `read_only`.
- `approvedSchemasOrDatasets` is a bounded non-empty allowlist of stable logical identifiers.
- `dataClassification` is explicit.
- `simulationNotice` is a required non-empty explanation.

**Ports and role:** Emits `relational_records` toward a separate retrieval input through an `advisory` edge. The type is always `simulated`, uses an `enterprise_system` trust-zone declaration in the template, and cannot be part of runtime traversal. Its label, description, configuration, implementation status, and documentation reference all state the simulation boundary. AO-003 opens no connection, loads no database driver, issues no query, and stores no credential value.

The fixture labels this node `Simulated Read-Only Enterprise Database`, selects `postgresql`, references the environment-variable name `ENTERPRISE_RAG_DATABASE_URL`, fixes access to `read_only`, allowlists logical dataset `approved_knowledge`, and includes an explicit simulation notice. No connection string is present.

## Enterprise RAG topology

The template reference is `enterprise-rag-question-answer` version `1.0.0`, named `Enterprise RAG Question-and-Answer Assistant`.

| Edge ID | Source port | Target port | Mode | Data contract |
|---|---|---|---|---|
| `user-to-input-guardrail` | `user-input.question-out` | `input-guardrail.question-in` | `runtime` | `user_query` |
| `input-guardrail-to-retrieval` | `input-guardrail.guarded-query-out` | `retrieval.guarded-query-in` | `runtime` | `guarded_query` |
| `document-source-to-retrieval` | `document-source.documents-out` | `retrieval.documents-in` | `runtime` | `document_collection` |
| `retrieval-to-gpt-agent` | `retrieval.context-out` | `gpt-agent.context-in` | `runtime` | `retrieval_context` |
| `gpt-agent-to-output-guardrail` | `gpt-agent.response-out` | `output-guardrail.response-in` | `runtime` | `agent_response` |
| `output-guardrail-to-evaluator` | `output-guardrail.guarded-response-out` | `evaluator.guarded-response-in` | `runtime` | `guarded_response` |
| `evaluator-to-response-output` | `evaluator.evaluated-response-out` | `response-output.evaluated-response-in` | `runtime` | `evaluated_response` |
| `simulated-database-to-retrieval` | `simulated-relational-database.records-out` | `retrieval.relational-records-in` | `advisory` | `relational_records` |

The database relationship is the only advisory edge. Advisory edges are excluded when the validator computes runtime reachability.

Positions are deterministic so a later canvas can place the nodes reproducibly. The fixture contains no changing timestamp, random ID, private data, connection value, or external-tool permission.

## Later bounded work

The component contracts are inputs to planned visual editing, authentication and ownership, persistence, OpenAI execution, document ingestion, retrieval, policy enforcement, evaluation execution, diagnostics, and exports. Those capabilities must not infer live behavior merely because AO-003 can parse a node marked `executable`.
