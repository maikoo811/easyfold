# Security Policy

## Reporting a vulnerability

Please **don't** open a public GitHub issue for security reports. Instead, email **cactus.texas@gmail.com** with:

- A description of the issue.
- Steps to reproduce (if applicable).
- The commit SHA / release tag where you observed it.

I'll acknowledge within 48 hours and aim to triage within one week. There's no bug bounty (this is a solo OSS project) — but I'll credit you in the fix commit / release notes unless you'd rather stay anonymous.

## Threat model

EasyFold is **BYOK + BYOC** (bring your own API key, bring your own cloud):

- The Anthropic API key lives only in the browser tab's React state — never sent to the EasyFold backend, never persisted to `localStorage`.
- Inference runs in **your** Modal account, not ours. We never run a hosted service.
- The backend is stateless (no DB, no auth, no user accounts). Job IDs are Modal's `FunctionCall.object_id` — ~131 bits of entropy, unguessable in practice. **But the URL is itself the auth token**: anyone who learns a `/predict/{jobId}` URL can read the result, so treat job URLs like bearer secrets (don't paste them in chat, screenshots, or email if the prediction is sensitive). There is no separate `Authorization` header to revoke.

That shape makes a few classes of report explicitly **in scope**:

- Frontend XSS or supply-chain attacks that could read the in-memory Anthropic key.
- Backend SSRF / path traversal / response-smuggling in the route layer or the UniProt / RCSB / ColabFold clients.
- Secrets leaked through error messages, logs, or response bodies.
- Dependency vulnerabilities with a demonstrable exploit path through EasyFold's own code.

And a few classes explicitly **out of scope**:

- Volumetric DoS against your own Modal account or your own Anthropic key — those are your bills, not ours.
- Prompt injection inside the Interpret panel. You're talking to your own Claude session with your own key; there's no exfiltration channel because no other user's data is in scope.
- Upstream issues in AlphaFold 3, Boltz-2, Mol\*, or ColabFold itself — please report those to their respective maintainers.
- Anything that requires already-compromised host credentials (e.g. a leaked Modal token, a stolen Anthropic key) — rotate the credential first, then file the upstream bug if there's one.

## What about my data?

See the **"What leaves your machine"** table in [`README.md`](README.md) — it lists every outbound request a prediction makes (ColabFold gets the sequence; UniProt/RCSB gets the accession ID only; Anthropic gets the summary stats + your question). If you spot an outbound request not on that list, that itself is a security report worth sending.
