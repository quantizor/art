security

Scope: client, server functions, workers, logging, and dependencies in this repo.

Input surfaces
- Screen every user-input surface: forms, URL params, API routes, worker messages, uploaded or persisted JSON.
- Validate at the boundary (see inputs.md). Do not trust client-side checks alone.

Secrets
- Do not log cookies, Authorization headers, API keys, or other secrets.
- Do not commit .env or credential files. Warn if asked to commit them.
- Keep third-party tokens out of client bundles unless they are public by design (e.g. anon read keys).

Logging
- Gate debug logging behind import.meta.env.DEV or a tree-shakeable helper so production builds drop the work and the strings.
- Error logs for operators may include ids and paths; never include session material.

Dependencies
- Install upgrades with lifecycle scripts off until a package proves it needs them.
- Prefer pinned versions recorded in package.json; read release notes before enabling scripts.

Static site
- GitHub Pages output under docs/ is public. Do not embed private endpoints or unreleased tokens in prerendered HTML or JS.

No auth layer
- This site has no user accounts or server-side session store. Do not add auth scaffolding without an explicit user request.

Workers and GPU
- Worker messages use tagged discriminant checks before acting on buffers (see inputs.md).
- Do not expose raw server filesystem paths in client error messages.
