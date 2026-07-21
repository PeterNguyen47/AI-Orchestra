# Export Contracts

AO-009 implements exactly two browser-local, client-session artifacts. Both are generated from validated in-memory state, downloaded as UTF-8 text, and never persisted or logged by AI Orchestra.

## Supported artifacts

| Artifact | Artifact type | Schema | MIME type |
|---|---|---|---|
| Complete workflow JSON | `ai-orchestra.workflow-export` | `1.0.0` | `application/json;charset=utf-8` |
| Architecture-assurance Markdown | `ai-orchestra.architecture-assurance` | `1.0.0` | `text/markdown;charset=utf-8` |

Filenames are derived only from the validated workflow ID, artifact type, and export schema version. They start with `ai-orchestra-`, are limited to 180 characters, reject separators, traversal, drive prefixes, control characters, and trailing periods or spaces, and end in lowercase `.json` or `.md`.

## Canonical workflow JSON

The JSON generator accepts unknown input at its domain boundary and reparses it through the unchanged strict Workflow `1.0.0` parser. It does not migrate, repair, coerce, redact, or discard fields. Structurally invalid workflows are blocked.

The complete normalized workflow is serialized by recursively sorting object keys while preserving every array order. Serialization uses two-space indentation, LF separators, and exactly one final newline. SHA-256 is computed in the browser with Web Crypto over those exact canonical workflow bytes. The fingerprint covers the workflow, not the export envelope.

The envelope includes:

- artifact type and workflow-export schema version;
- the lowercase SHA-256 workflow fingerprint;
- the complete normalized Workflow `1.0.0` object; and
- the authoritative architecture status plus fixed sanitized finding projections.

Every accepted architecture finding code maps to a fixed export explanation and remediation. Original free-form messages are not exported. An unsupported finding code fails closed. A structurally valid workflow may still export when architecture validation or execution readiness is blocked; its errors and warnings remain explicit. The final envelope is validated, the enclosed workflow is reparsed, and canonical bytes must remain identical.

Because the workflow JSON is complete, unsafe workflow content fails closed instead of being silently redacted. Recursive safety inspection rejects private-key material, credential and authorization values, API-key shapes, sessions and cookies, database URLs, absolute machine paths, and prohibited control characters. Schema-valid environment-variable names remain permitted because they are references rather than secret values.

## Architecture assurance and provenance

The assurance artifact is built from a strict typed allowlist containing:

- workflow, template, export-schema, assurance-schema, and RunEvidence schema identity;
- the canonical workflow fingerprint and exactly one originating run ID;
- authoritative node status (`executable`, `simulated`, or `roadmap`) and edge mode (`runtime` or `advisory`);
- node and edge inventory fields that are safe and relevant to architecture review;
- fixed sanitized architecture findings and bounded policy summaries;
- validated RunEvidence `1.0.0` status, fixed diagnostic explanation, nine-stage timeline, reached guardrail and retrieval facts, bounded model metadata, deterministic evaluator results, metrics, and security-control booleans; and
- explicit database-not-opened and database-not-queried statements.

Immediately before one governed action is submitted, the client synchronously captures the normalized workflow snapshot and its canonical bytes. The returned validated RunEvidence is bound only to that submitted snapshot. Assurance is unavailable without a binding. It is stale whenever current canonical bytes differ from submitted bytes. Restoring the exact prior canonical state re-enables assurance without another model request. A later validated run replaces the prior binding; page reload clears all bindings.

The assurance allowlist excludes workflow owner, node descriptions, raw configuration bodies, questions, answers, prompts, system instructions, retrieved passages, citation titles, provider bodies, raw errors, stack traces, endpoint URLs, credentials, session values, environment-variable names or values, repository or branch identity, local paths, host or user identity, and receipt data. The AO-007 receipt hash is never included. A model digest appears only when it is already present as bounded observed RunEvidence metadata.

Every externally derived Markdown value is normalized to one bounded line and escaped before rendering. Link, image, HTML, heading, list, blockquote, code, and table controls cannot introduce Markdown structure. The fixed section and item order, LF endings, and one final newline are deterministic.

## Browser download boundary

The complete artifact is generated and schema-validated before Blob creation. One client-only utility:

1. creates one UTF-8 Blob with the validated MIME type;
2. creates one object URL;
3. appends one temporary anchor with the validated filename;
4. clicks it once;
5. removes the anchor; and
6. revokes the object URL in a `finally` block immediately after initiation.

The browser does not open a popup, navigate, create a route, or send artifact content to the server. Artifact content is not stored in localStorage, sessionStorage, IndexedDB, a server file, a database, an export history, or logs.

## Validation and limitations

Golden-file tests compare exact JSON and synthetic assurance bytes and never rewrite the fixtures. Browser tests compare the workflow download to its checked-in golden, compare two assurance downloads from the same restored run binding, prove stale-run and unsafe-content blocking, and keep downloads inside Playwright temporary output. The deterministic loopback fixture is test infrastructure, not live-provider evidence.

The architecture-assurance artifact does not establish factual truth, semantic correctness, legal compliance, compliance certification, security approval, penetration-test completion, human review, or a signed attestation. Simulated and roadmap nodes were not executed. The optional GPT-5.6 provider remains disabled and is not demonstrated by these exports.
