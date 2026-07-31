git

Scope: version control and release process for this repo.

Approval
- Do not commit, push, deploy, or open a PR unless the user asks. Approval is per act and does not transfer.
- Do not run git stash. Prefer a temporary commit when the working tree must be cleared for parallel work.

Commits
- Write concise messages focused on why, in complete sentences.
- No attribution footers in commit messages or file headers.
- Never skip hooks (--no-verify) unless the user explicitly requests it.

Branches and PRs
- Fetch before reasoning about branch topology or diffs.
- When opening a PR at user request, push with -u and use gh pr create with summary and test plan.

Generated output
- docs/ is build output for GitHub Pages. It may change after bun run deploy; do not treat it as hand-authored source.
- Do not commit secrets or local-only config.

Dependencies
- Install with lifecycle scripts off by default: bun install --ignore-scripts (or equivalent) until a package proves it needs scripts.
- Run bun run verify before reporting work done.

CI
- No GitHub Actions or other hosted CI in this repo. Local bun run verify is the gate.

Changesets
- Do not add Changesets. Package is private and unpublished. Track deferred work in GitHub Issues.

Deploy
- bun run deploy is user-run. Do not deploy unless asked.
