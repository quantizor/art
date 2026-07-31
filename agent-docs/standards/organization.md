organization

Scope: file layout, naming, and module boundaries in this repo.

Structure
- Routes live under src/routes/ (file-based TanStack Router).
- Shared shell and chrome live under src/components/.
- Design system lives under src/ui/; import as ~/ui.
- Project scenes and engines live under src/projects/.
- lightcycle lives under src/games/lightcycle/ and mounts from NotFound (404), not a dedicated route.
- Server helpers and shared utils live under src/utils/.
- Agent standards live under agent-docs/. Research notes under research/. Never author in docs/.

Naming
- Persist identifiers (keys, route segments, config fields) in plain English a non-engineer would read.
- Alphabetize fields in declarations and object literals unless order is load-bearing; comment when order matters.

Reuse before rewrite
- Prefer extending src/ui/ and existing utils before hand-rolling parallel components or helpers.
- Match surrounding import style, naming, and abstraction level in every edit.

File size
- A source file past about a thousand lines is a prompt to ask whether to split. Generated files and cohesive engines may stay whole.

Generated artifacts
- Do not hand-edit src/routeTree.gen.ts. Regenerate through the router toolchain.

Deferred work
- Track open work in GitHub Issues, not in AGENTS.md or standards files.
