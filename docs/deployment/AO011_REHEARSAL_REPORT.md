# AO-011 clean-clone rehearsal report

## Evidence status

Status: `PENDING_LOCAL_REHEARSAL`

This implementation-commit template contains no fabricated timing or platform-validation value. Replace pending fields only after the exact first implementation commit passes clean-clone startup, readiness, the `@ao011` browser path, app restart, second readiness, and scoped full teardown. The later evidence commit must change only this report and `SUPPORTED_PLATFORMS.md`.

## Rehearsed source

- Implementation commit SHA: `PENDING`
- Evidence commit scope: `PENDING` (documentation only)
- Cache state: `PENDING` (`cold`, `warm`, or `unknown`)

## Sanitized environment

| Field | Result |
| --- | --- |
| Operating-system category | PENDING |
| CPU architecture | PENDING |
| Docker version | PENDING |
| Compose version | PENDING |
| Rounded available memory | PENDING |
| Rounded available disk | PENDING |

No username, hostname, IP address, filesystem path, Docker ID, private registry, credential, credential hash, session value, cookie, prompt, question, answer, citation title, provider output, receipt content, or raw log may be added.

## Measured timings

Record stopwatch durations without invented precision and keep setup separate from the interactive path.

| Phase | Duration | Result code |
| --- | --- | --- |
| Clone and checkout | PENDING | PENDING |
| Compose config validation | PENDING | PENDING |
| Tooling and app build | PENDING | PENDING |
| Credential bootstrap | PENDING | PENDING |
| App startup and health readiness | PENDING | PENDING |
| Internal readiness command | PENDING | PENDING |
| Interactive AO-011 browser path | PENDING | PENDING |
| App restart and second readiness | PENDING | PENDING |
| Full scoped teardown | PENDING | PENDING |

## Vertical-slice results

| Check | Result |
| --- | --- |
| Fresh clone contained no prior build, credential, receipt, test, coverage, or browser state | PENDING |
| Credential bootstrap output was captured transiently and not disclosed | PENDING |
| First internal readiness returned `AO011_READY` | PENDING |
| Canonical workflow showed nine nodes and eight edges | PENDING |
| Architecture validation and execution readiness passed | PENDING |
| Governed answer, one citation, nine-stage RunEvidence, evaluators, and database-not-opened evidence passed | PENDING |
| Workflow JSON retained AO-009 schema/content contract | PENDING |
| Assurance Markdown bound to the AO-011 run without a live-inference claim | PENDING |
| Stale assurance blocked and exact restoration re-enabled it without another generation | PENDING |
| One injection attempt blocked with no extra fixture invocation | PENDING |
| Logout and protected-route denial passed | PENDING |
| Serious or critical accessibility violations | PENDING |
| Deterministic adapter invocations | PENDING (required: 1) |
| Ollama requests | PENDING (required: 0) |
| OpenAI requests | PENDING (required: 0) |

## Restart results

- App-only restart: `PENDING`
- Second readiness code: `PENDING`
- Fresh browser canonical seed: `PENDING`
- Prior question, answer, mutation, run, or export state present: `PENDING`
- Process-local rate-limiter reset boundary confirmed: `PENDING`

## Teardown results

- Scoped command: `docker compose down --timeout 15 --volumes --remove-orphans`
- Project containers remaining: `PENDING`
- Project network remaining: `PENDING`
- Judge credential volume remaining: `PENDING`
- Unrelated Docker resources modified: `PENDING` (required: no)

## Non-disclosure and provider boundary

The final report may record public commit SHA, platform category, architecture, Docker/Compose versions, rounded resources, cache category, durations, fixed codes, stable test counts, and pass/fail results only. The AO-007 receipt is neither accessed nor copied and does not validate this fixture. No native/containerized Ollama or OpenAI request is permitted. Approved OpenAI credits must remain unused.
