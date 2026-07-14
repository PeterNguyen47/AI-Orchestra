# Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Trigger / owner |
|---|---|---:|---:|---|---|
| R-001 | Eight-day schedule compresses testing | High | High | Vertical slice first; one-item WIP; daily gates | Missed daily gate / project owner |
| R-002 | Model/API behavior or access blocks execution | Medium | High | Server-side adapter, deterministic fixtures, early live test | First live call fails / AI Runtime |
| R-003 | Prompt injection or data leakage | High | High | Bounded retrieval, guardrails, red-team tests, no real secrets/data | Adversarial test failure / Security |
| R-004 | Simulated nodes are mistaken for executable | Medium | High | Persistent status labels and export metadata | Ambiguous UI/claim / Product |
| R-005 | Judge setup is unreliable | Medium | High | Docker path and clean-machine rehearsal by July 20 | Setup exceeds runbook / DevOps |
| R-006 | Cost or denial-of-wallet exposure | Medium | High | Request limits, budgets, timeouts, token caps, observable usage | Abnormal usage / AI Runtime |
| R-007 | Submission evidence is incomplete | Medium | High | Checklist ownership and July 20 rehearsal | Missing video/session ID / Submission |
