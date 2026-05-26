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

## If you expose the backend as a public service

EasyFold's threat model assumes **you run the backend for yourself** (or a small trusted team) on `localhost` or a private network. The defaults reflect that:

- `EASYFOLD_CORS_ORIGINS` defaults to `localhost:3000,3001`.
- Error responses include verbose detail (`"Modal Function easyfold-boltz/run_boltz is not deployed in this workspace. Run ./modal/deploy.sh boltz first."`) — friendly when *you* are debugging your own deploy.
- No rate limiting on `POST /api/v1/jobs`.

If you publish the backend as a service strangers can hit, **these defaults become risks** and you should harden:

1. **Add rate limiting.** A single `POST /api/v1/jobs` spawns a Modal Function call against *your* Modal account; an unfriendly user can burn your credits in minutes. Use [`slowapi`](https://pypi.org/project/slowapi/), an upstream gateway (Cloudflare, nginx `limit_req`), or your platform's built-in rate limiter. Cap per-IP and per-hour.
2. **Generic-ify error responses.** The 502 responses currently echo Modal's error string. For a public deployment, intercept the `JobNotFound` / `ModalDispatchError` / `ModalFunctionNotDeployed` handlers in `backend/easyfold/main.py` to return a generic `{"detail": "upstream error"}` and log the detail server-side instead.
3. **Tighten CORS.** Set `EASYFOLD_CORS_ORIGINS` to your real frontend origin(s) — never wildcard.
4. **Authenticate `/api/v1/jobs/{job_id}`.** Today the job ID is a bearer secret (~131 bits, unguessable). For a multi-tenant public service, add a session or API-key check so URL leaks don't expose results.
5. **Consider a TLS-terminating proxy.** The FastAPI process serves HTTP; production deploys should put it behind nginx / Caddy / a managed load balancer with HTTPS + HSTS.
6. **Re-audit the Anthropic key flow.** EasyFold ships with browser-direct fetch to `api.anthropic.com`. A public deployment increases the value of a malicious-JS supply-chain attack against the key. You may want a backend-relay flavor (note: this changes the privacy contract — document it).

These hardenings are **out of scope for v1.0** because the primary supported use case is BYOC self-host. If you do harden a public deployment, please open an issue or send a PR — we'd like to upstream the docs.
