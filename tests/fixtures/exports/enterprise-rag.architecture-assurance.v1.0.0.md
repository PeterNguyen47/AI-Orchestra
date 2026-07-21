# AI Orchestra architecture assurance

## Artifact identity

- Artifact type: ai\-orchestra\.architecture\-assurance
- Assurance schema version: 1\.0\.0
- Workflow export schema version: 1\.0\.0
- RunEvidence schema version: 1\.0\.0

## Workflow identity and provenance

- Workflow schema version: 1\.0\.0
- Workflow ID: enterprise\-rag\-question\-answer
- Workflow name: Enterprise RAG Question\-and\-Answer Assistant
- Template ID: enterprise\-rag\-question\-answer
- Template version: 1\.0\.0
- Workflow fingerprint SHA-256: b8eaa2454d79dd87fa78019ca62949e25bc479b2037146406d2fc88894343e07
- Originating run ID: run\_00000000\-0000\-4000\-8000\-000000000009

## Architecture status

- Structure valid: Yes
- Architecture valid: Yes
- Execution ready: Yes
- Error count: 0
- Warning count: 0

## Node inventory

### Node 1: User Question

- Node ID: user\-input
- Node type: user\_input
- Implementation status: executable
- Data classification: internal
- Trust zone: browser
- Documentation reference: docs/architecture/COMPONENT\_MODEL\.md\#user\-input

### Node 2: Input Guardrail

- Node ID: input\-guardrail
- Node type: input\_guardrail
- Implementation status: executable
- Data classification: internal
- Trust zone: application
- Documentation reference: docs/architecture/COMPONENT\_MODEL\.md\#input\-guardrail

### Node 3: Bundled Enterprise Documents

- Node ID: document\-source
- Node type: document\_source
- Implementation status: executable
- Data classification: confidential
- Trust zone: application
- Documentation reference: docs/architecture/COMPONENT\_MODEL\.md\#document\-source

### Node 4: Citation\-Aware Retrieval

- Node ID: retrieval
- Node type: retrieval
- Implementation status: executable
- Data classification: confidential
- Trust zone: application
- Documentation reference: docs/architecture/COMPONENT\_MODEL\.md\#retrieval

### Node 5: Qwen3 4B Answer Agent

- Node ID: gpt\-agent
- Node type: gpt\_agent
- Implementation status: executable
- Data classification: confidential
- Trust zone: application
- Documentation reference: docs/architecture/COMPONENT\_MODEL\.md\#gpt\-agent

### Node 6: Grounded Output Guardrail

- Node ID: output\-guardrail
- Node type: output\_guardrail
- Implementation status: executable
- Data classification: confidential
- Trust zone: application
- Documentation reference: docs/architecture/COMPONENT\_MODEL\.md\#output\-guardrail

### Node 7: Answer Quality Evaluator

- Node ID: evaluator
- Node type: evaluator
- Implementation status: executable
- Data classification: confidential
- Trust zone: application
- Documentation reference: docs/architecture/COMPONENT\_MODEL\.md\#evaluator

### Node 8: Cited Response

- Node ID: response\-output
- Node type: response\_output
- Implementation status: executable
- Data classification: confidential
- Trust zone: browser
- Documentation reference: docs/architecture/COMPONENT\_MODEL\.md\#response\-output

### Node 9: Simulated Read\-Only Enterprise Database

- Node ID: simulated\-relational\-database
- Node type: relational\_database
- Implementation status: simulated
- Data classification: confidential
- Trust zone: enterprise\_system
- Documentation reference: docs/architecture/COMPONENT\_MODEL\.md\#relational\-database\-simulated

## Edge inventory

### Edge 1: Question

- Edge ID: user\-to\-input\-guardrail
- Source: user\-input\.question\-out
- Target: input\-guardrail\.question\-in
- Mode: runtime
- Data contract: user\_query

### Edge 2: Approved query

- Edge ID: input\-guardrail\-to\-retrieval
- Source: input\-guardrail\.guarded\-query\-out
- Target: retrieval\.guarded\-query\-in
- Mode: runtime
- Data contract: guarded\_query

### Edge 3: Approved documents

- Edge ID: document\-source\-to\-retrieval
- Source: document\-source\.documents\-out
- Target: retrieval\.documents\-in
- Mode: runtime
- Data contract: document\_collection

### Edge 4: Cited context

- Edge ID: retrieval\-to\-gpt\-agent
- Source: retrieval\.context\-out
- Target: gpt\-agent\.context\-in
- Mode: runtime
- Data contract: retrieval\_context

### Edge 5: Draft answer

- Edge ID: gpt\-agent\-to\-output\-guardrail
- Source: gpt\-agent\.response\-out
- Target: output\-guardrail\.response\-in
- Mode: runtime
- Data contract: agent\_response

### Edge 6: Guarded answer

- Edge ID: output\-guardrail\-to\-evaluator
- Source: output\-guardrail\.guarded\-response\-out
- Target: evaluator\.guarded\-response\-in
- Mode: runtime
- Data contract: guarded\_response

### Edge 7: Evaluated answer

- Edge ID: evaluator\-to\-response\-output
- Source: evaluator\.evaluated\-response\-out
- Target: response\-output\.evaluated\-response\-in
- Mode: runtime
- Data contract: evaluated\_response

### Edge 8: Simulated enterprise records \(advisory only\)

- Edge ID: simulated\-database\-to\-retrieval
- Source: simulated\-relational\-database\.records\-out
- Target: retrieval\.relational\-records\-in
- Mode: advisory
- Data contract: relational\_records

## Validation and readiness findings

- No findings.

## Policies and security boundaries

- Default data classification: confidential
- Human approval required: No
- Maximum steps: 16
- Maximum total tokens: 100000
- Maximum estimated cost USD: 10
- Allowed-tool count: 0
- Groundedness threshold: 0\.8
- Relevance threshold: 0\.75
- Citation-coverage threshold: 0\.9
- Overall evaluation threshold: 0\.8
- Deployment profile: local\_docker
- Required environment-variable count: 0

## Originating governed run

- Run ID: run\_00000000\-0000\-4000\-8000\-000000000009
- Status: completed
- Code: RUN\_COMPLETED
- Fixed explanation: The governed run completed with validated evidence\.
- Target provider: synthetic\-provider
- Target model: synthetic\-model
- Target deployment mode: test\_only
- Model invocation reached: Yes
- Observed model: synthetic\-model
- Observed model digest: sha256:synthetic\-digest
- Observed runtime: SyntheticRuntime
- Observed runtime version: 1\.0\.0\-test

## Ordered execution timeline

1. user\-input - user\_input - passed
2. input\-guardrail - input\_guardrail - passed
3. document\-source - document\_source - passed
4. retrieval - retrieval - passed
5. gpt\-agent - gpt\_agent - passed
6. output\-guardrail - output\_guardrail - passed
7. evaluator - evaluator - passed
8. response\-output - response\_output - passed
9. simulated\-relational\-database - relational\_database - simulated

## Guardrail and retrieval evidence

- Input guardrail status: passed
- Input guardrail code: INPUT\_GUARDRAIL\_PASSED
- Input guardrail explanation: The input passed the configured deterministic guardrail checks\.
- Input character count: 80
- Maximum input characters: 4000
- Prompt-injection detection enabled: Yes
- Retrieval status: passed
- Retrieval code: RETRIEVAL\_COMPLETED
- Retrieval explanation: Deterministic bounded retrieval returned approved context\.
- Requested top K: 5
- Returned chunk count: 1
- Minimum relevance threshold: 0\.72
- Maximum context characters: 24000
- Minimum aggregate relevance: 0\.8
- Maximum aggregate relevance: 0\.9
- Mean aggregate relevance: 0\.85
- Output guardrail status: passed
- Output guardrail code: OUTPUT\_GUARDRAIL\_PASSED
- Output guardrail explanation: The output passed schema, citation, active\-content, and sensitive\-data checks\.
- Schema validated: Yes
- Citations required: Yes
- Citations validated: Yes
- Accepted citation count: 1
- Active content detected: No
- Sensitive data detected: No
- Insufficient context: No

## Deterministic evaluator results

- Evaluator ID: citation\_coverage\.v1
- Status: passed
- Score: 1
- Threshold: 0\.9
- Fixed explanation: Required citations use accepted retrieved identifiers\.

- Evaluator ID: retrieval\_relevance\.v1
- Status: passed
- Score: 0\.85
- Threshold: 0\.75
- Fixed explanation: Rounded aggregate lexical relevance meets the configured threshold\.

- Evaluator ID: structural\_grounding\.v1
- Status: passed
- Score: 1
- Threshold: 0\.8
- Fixed explanation: The output passed the required schema and citation\-structure checks\.

## Usage, duration, and cost

- Total duration milliseconds: 90
- Provider duration milliseconds: 75
- Input tokens: 40
- Output tokens: 10
- Total tokens: 50
- Estimated cost USD: 0
- External API cost USD: 0
- Local compute cost measured: No

## Database and execution controls

- Model calls server-side: Yes
- Provider selection exposed to browser: No
- Credentials stored: No
- Prompts stored: No
- Raw errors stored: No
- Database opened: No
- Database queried: No
- Remote tracing used: No
- Persistence used: No
- Tools used: No
- Handoffs used: No
- Thinking stored: No

- The relational database was not opened.
- The relational database was not queried.

## Limitations and non-claims

- Deterministic evaluators do not establish factual truth or semantic correctness.
- This artifact does not establish legal compliance, certification, or security approval.
- This artifact is not a penetration test, human review, or signed attestation.
- Simulated and roadmap nodes were not executed.
- Optional GPT-5.6 is not demonstrated or enabled.
- Deterministic browser fixtures are test infrastructure rather than live-provider evidence.
