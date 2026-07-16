# Codex Usage Evidence

Codex assisted implementation, testing, security review, accessibility, CI preparation, documentation, and the bounded GitHub issue/Project/PR workflow. Human decisions remained authoritative for scope, architecture, model choice, acceptance gates, and merge.

## AO-007 pivot - 2026-07-16

Codex preserved the provider-neutral executor and optional GPT-5.6 adapter; implemented the native-fetch Ollama `qwen3:4b` adapter, strict loopback configuration, canonical workflow revision, normalized metadata/usage/cost, safe UI states, local receipt script, deterministic mocked-transport tests, schema regeneration, threat/test documentation, and draft PR updates. The active Codex worker model was session-selected GPT-5 and was not pinned or written to repository/user configuration. It is distinct from the AI Orchestra runtime model.

No feedback Session ID is fabricated. The qualifying session is the Codex session containing the majority of this core pivot implementation; run `/feedback` in that session and record the returned ID during submission preparation. A missing feedback ID blocks submission preparation, not code merge.
