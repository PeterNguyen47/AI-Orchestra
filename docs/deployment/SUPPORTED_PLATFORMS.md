# AO-011 supported-platform matrix

## Status definitions

- `validated`: the exact AO-011 clean-clone startup, readiness, browser path, restart, and teardown passed on the recorded platform.
- `expected_compatible`: reviewed components and upstream images support the platform, but the exact rehearsal has not passed there.
- `not_tested`: no sufficient AO-011 execution evidence exists.
- `unsupported`: the authored contract intentionally does not support the platform.

## Portable judge mode

| Platform                                        | Architecture    | Status              | Evidence boundary                                                                                                                   |
| ----------------------------------------------- | --------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Windows 11, Docker Desktop, Linux containers    | x86_64          | not_tested          | No exact AO-011 remediation rehearsal is recorded.                                                                                  |
| GitHub-hosted Ubuntu 24.04.4 LTS, Docker Engine | x86_64          | validated           | Ephemeral clean checkout passed exact-head AO-011 run 29872186329 at remediation commit `f983cea90d19bf2a7ac8291a0aee159446d74ab3`. |
| Other Linux Docker Engine with Compose v2       | x86_64          | expected_compatible | Exact AO-011 rehearsal not recorded outside the observed hosted Ubuntu runner.                                                      |
| macOS Docker Desktop                            | arm64 or x86_64 | expected_compatible | Pinned official Node Alpine image is multi-architecture; exact AO-011 rehearsal absent.                                             |
| Linux Docker Engine with Compose v2             | arm64           | not_tested          | No exact architecture run recorded.                                                                                                 |
| Windows containers                              | x86_64          | unsupported         | Dockerfile and Compose contract target Linux containers.                                                                            |
| Docker Compose v1                               | any             | unsupported         | The runbook requires Compose v2 profiles, health dependencies, and `--wait`.                                                        |
| Kubernetes, Helm, or cloud orchestrators        | any             | unsupported         | Explicit AO-011 non-goal.                                                                                                           |

Only the rehearsal report may promote a row to `validated`. Review, image manifest support, or a prior app-only smoke test is not platform validation.

## Version and architecture contract

- Docker Engine 24 or current Docker Desktop with Linux-container execution is the conservative minimum.
- Docker Compose v2.24 or newer is the conservative minimum for the authored profile and wait commands.
- The application and tooling images pin Node `24.17.0` on the official Alpine image.
- x86_64 Linux is `validated` only for the recorded hosted Ubuntu environment; arm64 remains `not_tested` until the exact locked dependency graph and browser path pass there.
- GPU execution is neither required nor claimed for portable judge mode.

The validated hosted environment used Docker Engine `28.0.4` and Docker Compose `2.38.2`. It does not validate Windows, macOS, arm64, Docker Desktop, or a developer workstation.

## Resource and network prerequisites

Portable judge-mode planning minimums are 2 CPU cores, 4 GB available memory, and 4 GB free disk. These are conservative setup bounds, not measured production sizing. The clean-clone report must record rounded available memory/disk and actual timings before any measured claim replaces them.

The validated ephemeral runner reported 15 GiB rounded available memory and 87 GiB rounded available disk. Those observations establish the recorded runner's available resources, not minimum sizing or universal portability.

The first clone/build needs outbound access to GitHub, the official Node base-image registry, and the locked npm package sources. No provider endpoint, model registry, Ollama endpoint, or OpenAI endpoint is used. After images and credentials exist, same-checkout restart is expected to work without provider access; complete cold offline build is not claimed.

Port 3000 is the default host binding. `AI_ORCHESTRA_PORT` may select another unused unprivileged host port. WSL is not required when Docker Desktop already supplies Linux containers.

## Optional live local-model mode

Native-host Ollama `qwen3:4b` is separate from portable judge mode. Plan for at least 4 CPU cores, 8 GB available memory, 10 GB free disk, model-download network access, and longer startup. Those values are conservative, not a validated performance guarantee. No GPU, containerized Ollama, remote Ollama, or silent fallback is supported by AO-011.

## Rehearsal updates

Update validation status only in an evidence-only commit that names the exact rehearsed implementation SHA and sanitized environment category. Never record username, hostname, IP, local path, Docker ID, credentials, session values, questions, answers, citations, provider output, or raw logs.
