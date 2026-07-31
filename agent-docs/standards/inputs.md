inputs

Scope: anything crossing a trust boundary (network, URL, storage, workers, file upload, server functions).

Trust model
- Treat the frontend as untrusted. The server and workers re-validate every value that gates behavior, access, or persistence.

Zod at boundaries
- Validate path params, request bodies, res.json() payloads, and persisted JSON with Zod or hand-written guards at the boundary.
- Server functions must use .inputValidator with a Zod schema. Do not use identity validators that pass input through unchanged.
- Infer types from schemas where possible instead of maintaining parallel hand-written types.

Worker transferables
- Worker messages carrying ArrayBuffer or other transferables use hand-written guards: discriminant tag, expected byteLength, and shape checks.
- Do not run Zod on raw transferable buffers; validate structure before transfer and after receive.

Errors
- Validation failures throw or return errors that say what field failed and what was expected.
- Do not log raw request bodies that may contain secrets.

Loaders and server functions
- Loaders are isomorphic; validate on both sides when data can originate from the client.
- See agent-docs/tanstack-start.md for TanStack Start patterns.

No database
- This repo has no migrations or ORM. Persisted JSON files and browser storage still need schema validation on read.
