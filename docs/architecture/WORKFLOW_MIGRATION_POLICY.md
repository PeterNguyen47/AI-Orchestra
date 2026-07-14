# Workflow Migration Policy

## Current contract

`CURRENT_WORKFLOW_SCHEMA_VERSION` is `1.0.0` and is the only supported workflow schema version. The constant, current parser, and migration entry point live under `src/domain/workflow/` so later visual, validation, execution, and export modules consume one version policy.

AO-003 establishes the migration boundary; it does not invent a historical format. There is no pre-1.0 fixture, adapter, or implied compatibility.

## Entry-point behavior

Migration accepts an unknown JSON-compatible value and returns a structured result. It first inspects `schemaVersion` without coercing the input or removing properties.

| Input state | Result |
|---|---|
| `schemaVersion` is `1.0.0` | Run the canonical strict parser and return the canonical current workflow only when it is structurally valid. |
| `schemaVersion` is absent or not a valid semantic version | Return an explicit invalid- or missing-version failure. |
| Version is older than `1.0.0` | Return an explicit unsupported historical-version result. No best-effort conversion occurs. |
| Version is newer than `1.0.0` | Fail closed with an application-upgrade-required result. |
| Version has equal precedence but is not exactly `1.0.0`, such as `1.0.0+local` | Return an explicit `unsupported_version` result; build metadata never bypasses the exact-version contract. |
| Version is `1.0.0` but the document has an unknown or invalid field | Return the canonical structural validation issues, including their JSON-style paths. |

Current-version migration is therefore validation and canonicalization, not transformation. It preserves all accepted information and silently discards nothing.

## Compatibility guarantees

- Readers support only versions for which an explicit schema and migration path exist.
- Unknown versions never fall back to the current parser as if compatible.
- Unknown properties are not stripped during migration.
- A migration must not turn a `simulated` or `roadmap` component into `executable` without an explicit, reviewed semantic decision.
- Secret values must never be introduced or copied into a workflow. Migrations may preserve or create environment-variable reference names only.
- The canonical serializer writes deterministic JSON but does not change the schema version or migrate data.
- Structural migration and semantic graph validation remain separate. A successfully migrated workflow must still pass semantic validation before later execution code may accept it.

## Adding a future version

Every future schema version requires one bounded change that:

1. records the compatibility decision and field-level mapping in an ADR or approved amendment;
2. adds a strict schema for the new version without weakening prior-version parsing;
3. adds an explicit, typed migration from each supported source version;
4. preserves stable workflow, node, edge, and port identifiers unless the decision explains an unavoidable change;
5. maps every removed or renamed property deliberately and rejects data that cannot be represented safely;
6. updates the central current-version constant only after the new schema and migration exist;
7. regenerates the committed Draft 2020-12 JSON Schema deterministically;
8. adds fixtures for successful migration, malformed input, unknown properties, semantic-status changes, embedded-secret defense, and round-trip stability;
9. tests older, current, and unknown future version routing; and
10. updates the workflow schema, component model, threat model, changelog, and template only when the approved product contract requires it.

A future migration is complete only when the source fixture parses under its own strict schema, the explicit migration succeeds, the destination parses under the new canonical schema, semantic validation is run separately, and serialize/reparse stability is demonstrated.

## Non-goals

AO-003 does not provide downgrade support, speculative legacy formats, remote migration services, database migrations, in-place file mutation, workflow execution, or visual editor compatibility shims.
