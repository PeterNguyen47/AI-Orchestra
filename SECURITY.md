# Security Policy

AI Orchestra is currently a hackathon prototype, not a production-certified system.

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities. Use GitHub's private vulnerability reporting for this repository when available. If it is unavailable, contact the repository owner privately through a trusted channel and include reproduction details without live secrets or personal data.

## Secret handling

Never commit API keys, credentials, tokens, private keys, session values, or production data. Keep model calls and secrets server-side, use local environment files ignored by Git, rotate exposed values immediately, and use placeholders in examples.

## Prototype limitations

AO-007 keeps provider credentials and model calls server-side. Live execution requires an explicit feature flag and key, while startup and health remain key-free. Browser input cannot select a provider. Input screening precedes retrieval and paid calls; untrusted documents are delimited as data; structured output, citations, active markup, and likely sensitive values are checked before display. Runs have timeout, token, estimated-cost, per-subject, and process-local concurrency bounds and no automatic paid-call retry.

The committed corpus is synthetic. The simulated database is never opened or queried. Questions, retrieved passages, answers, raw provider responses/errors, and reasoning are not persisted or included in structured logs. These controls do not constitute production DLP, distributed rate limiting, tenant isolation, or compliance certification.

AO-004 uses one seeded local demonstration account, a versioned scrypt password hash, and an at-most-eight-hour signed stateless session. The cookie is HttpOnly, SameSite=Lax, path `/`, and Secure in production. Protected server layouts verify the session even when Proxy already redirected navigation.

The generated plaintext password exists only in ignored `.demo-credentials.txt`; the session secret and password hash exist only in ignored `.env.local`. Delete or regenerate both files when the local demonstration is complete. Never share or commit them.

This is not production identity: there is no registration, recovery, MFA, external identity provider, persistent session revocation, rate limiter, complex multi-tenancy, or compliance certification. Additional hardening remains later bounded work.
