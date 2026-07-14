# Threat Model

**Status:** Design baseline for a hackathon prototype; controls are planned until evidenced by implementation.

## Assets and boundaries

Protect API credentials, session integrity, workflow definitions, retrieved content, uploaded content, model inputs/outputs, evaluation evidence, exports, and cost budget. Browser, uploads, retrieved text, simulated connectors, and model output are untrusted. Secrets and privileged actions remain server-side.

| Threat | Example | Required control | Validation |
|---|---|---|---|
| Prompt injection | Retrieved document asks the model to ignore policy | Separate instructions from data, delimit context, allowlist actions, apply input/output policy | Adversarial retrieval fixtures |
| Data leakage | Model output exposes secrets or another user's content | Never place secrets in prompts, minimize context, redact logs/exports, scope storage | Canary and cross-session tests |
| Excessive agency | Model takes consequential action without approval | No arbitrary tools; bounded read-only MVP tools; explicit authorization policy | Tool allowlist tests |
| Unauthorized tool execution | Crafted node invokes an undeclared tool | Versioned schema, server-side registry, deny unknown tools | Negative schema/runtime tests |
| Insecure connectors | Connector trusts hostile responses or broad credentials | Simulate CRM in MVP; validate payloads; least privilege and timeouts for future connectors | Malformed-response fixtures |
| Malicious uploads | Oversized or active content attacks parsers | Type/size limits, safe parsing, quarantine/rejection, treat content as data | File-type and size tests |
| Cross-user access | One session reads another architecture | Seeded demo identity with server-side ownership checks; no production multi-tenancy claim | Session-isolation tests |
| Secret exposure | Key appears in Git, logs, UI, or export | Environment injection, ignored files, redaction, secret scanning, rotation playbook | Repository and log scans |
| Denial of wallet | Repeated/large calls consume budget | Rate limits, token caps, timeouts, concurrency limits, usage logging and budget stops | Limit and load tests |

## Residual limitations

Seeded demo authentication, local SQLite, simulated CRM, and hackathon operations are not production controls. Production identity, tenant isolation, connector hardening, retention, audit immutability, incident response, and compliance assessment remain roadmap work.
