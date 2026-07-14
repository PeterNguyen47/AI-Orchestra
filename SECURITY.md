# Security Policy

AI Orchestra is currently a hackathon prototype, not a production-certified system.

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities. Use GitHub's private vulnerability reporting for this repository when available. If it is unavailable, contact the repository owner privately through a trusted channel and include reproduction details without live secrets or personal data.

## Secret handling

Never commit API keys, credentials, tokens, private keys, session values, or production data. Keep model calls and secrets server-side, use local environment files ignored by Git, rotate exposed values immediately, and use placeholders in examples.

## Prototype limitations

The MVP will use seeded demo authentication, simulated enterprise integration, local-first persistence, bounded tools, and incomplete production controls. It will not claim production identity, multi-tenancy, compliance certification, unrestricted tool execution, or hardened cloud deployment.
