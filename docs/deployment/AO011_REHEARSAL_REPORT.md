# AO-011 clean-clone rehearsal report

## Evidence status

Status: `VALIDATED_HOSTED_EPHEMERAL_REHEARSAL`

The original implementation-template marker `PENDING_LOCAL_REHEARSAL` is superseded by exact-ref hosted evidence. GitHub Actions run `29864114791` used an ephemeral clean checkout and passed quality, Docker Compose, and browser jobs at the implementation commit below. This is hosted Linux evidence, not a local-workstation rehearsal.

## Rehearsed source

- Implementation commit SHA: `46131cfd04aa40f60e480b7741eaf7be0a288ac6`
- Hosted workflow run: `29864114791` (`workflow_dispatch`, exact implementation ref)
- Evidence commit scope: this report and `SUPPORTED_PLATFORMS.md` only
- Cache state: `unknown` (the hosted logs did not prove a fully cold or warm image cache)

## Sanitized environment

| Field | Result |
| --- | --- |
| Operating-system category | GitHub-hosted Ubuntu 24.04.4 LTS, ephemeral clean checkout |
| CPU architecture | x86_64 |
| Docker version | 28.0.4 |
| Compose version | 2.38.2 |
| Rounded available memory | 14 GiB |
| Rounded available disk | 87 GiB |

No username, hostname, IP address, filesystem path, Docker ID, private registry, credential, credential hash, session value, cookie, prompt, question, answer, citation title, provider output, receipt content, or raw log may be added.

## Measured timings

Durations come from GitHub Actions step `started_at` and `completed_at` metadata, rounded to whole seconds. A value below one second is reported as `<1 s`. The AO-011 browser duration comes from Playwright's phase summary rather than the aggregate browser-job step.

| Phase | Duration | Result code |
| --- | --- | --- |
| Clone and checkout | 1 s | PASS |
| Compose config validation | <1 s | PASS |
| Tooling and app build | 53 s | PASS |
| Credential bootstrap | 5 s | `AO011_AUTH_READY` |
| App startup and health readiness | 6 s | PASS |
| Internal readiness command | 2 s | `AO011_READY` |
| Interactive AO-011 browser path | 9.4 s | PASS |
| App restart and second readiness | 8 s | `AO011_READY` |
| Full scoped teardown | 1 s | PASS |

Aggregate hosted job durations were 61 seconds for Quality and security, 81 seconds for Docker Compose smoke, and 115 seconds for the browser job. The browser test step itself was 63 seconds and is not presented as interactive-path time.

## Vertical-slice results

| Check | Result |
| --- | --- |
| Fresh clone contained no prior build, credential, receipt, test, coverage, or browser state | PASS — ephemeral hosted checkout |
| Quiet credential bootstrap disclosed no credential or derived value | PASS |
| First internal readiness returned `AO011_READY` | PASS |
| Canonical workflow showed nine nodes and eight edges | PASS |
| Architecture validation and execution readiness passed | PASS |
| Governed answer, one citation, nine-stage RunEvidence, evaluators, and database-not-opened evidence passed | PASS |
| Workflow JSON retained AO-009 schema/content contract | PASS |
| Assurance Markdown bound to the AO-011 run without a live-inference claim | PASS |
| Stale assurance blocked and exact restoration re-enabled it without another generation | PASS |
| One injection attempt blocked with no extra fixture invocation | PASS |
| Logout and protected-route denial passed | PASS |
| Serious or critical accessibility violations | 0 |
| Deterministic adapter invocations | 1 |
| Ollama requests | 0 |
| OpenAI requests | 0 |

The quality job passed 53 Vitest files and 370 cases with 95.28% statements, 91.04% branches, 97.32% functions, and 96.16% lines. The browser job passed ten Chromium scenarios split seven provider-disabled, two legacy governed, and one AO-011 fixture scenario. Legacy fixture counts remained tags=1/version=1/chat=1/unexpected=0.

## Restart results

- App-only restart: `PASS`
- Second readiness code: `AO011_READY`
- Fresh browser canonical seed: passed in the isolated AO-011 browser phase; it was not re-run inside the restarted Compose container
- Prior question, answer, mutation, run, or export state present: none in the isolated browser phase; post-restart browser state was not separately inspected
- Process-local rate-limiter reset boundary confirmed: app-process restart completed, but the counter reset was not separately exercised

## Teardown results

- Scoped command: `docker compose down --timeout 15 --volumes --remove-orphans`
- Project containers remaining: 0
- Project network remaining: 0
- Judge credential volume remaining: 0
- Unrelated Docker resources modified: no; teardown used only the scoped Compose command

## Dependency audit

- Exact override: `@hono/node-server` `2.0.5`
- Root `@openai/agents` version: unchanged at `0.13.4`
- Hosted audit result: 0 vulnerabilities
- No `npm audit fix`, forced upgrade, advisory suppression, or exploitability claim was used.

## Non-disclosure and provider boundary

The report records only public commit/run identifiers, platform category, architecture, Docker/Compose versions, rounded resources, cache category, durations, fixed codes, stable test counts, and pass/fail results. Log review found no unmasked authentication value, password, password hash, session secret, cookie, provider invocation, model download, or receipt reference. Masked checkout authorization records, raw logs, runner paths, loopback bindings, and Docker identifiers were not transferred into this evidence. The AO-007 receipt was neither accessed nor copied and does not validate this fixture. No native/containerized Ollama or OpenAI request occurred, so approved OpenAI credits were not used by the rehearsal.
