method

Scope: how agents plan, implement, verify, and hand off work in this repo.

Fix at the cause
- A change that hides a symptom without removing the cause is a suppression.
- No casts, lint disables, snapshot rubber-stamps, or retries that paper over a real defect.
- If the cause is out of reach, say so and log the suppression explicitly.

One fact, one home
- Every fact lives in exactly one authoritative place. Elsewhere, derive or point.
- After renaming or changing a value, update every place that recorded the old fact in the same pass: code, tests, agent-docs, UI showcase, comments.

Before calling done
- Argue the opposite: hunt for a breaking input, unsupported claim, or skipped requirement.
- Re-read changed files or re-run bun run verify before reporting.
- Visual changes require rendering and looking at the result; passing tests alone are not enough for UI or GPU work.

Planning
- When planning non-trivial work, include Do's and Don'ts, concrete code samples, and pointers into AGENTS.md or agent-docs/.
- Question over-engineering; propose the simpler alternative when complexity does not buy observable behavior.

Dev server
- Never run bun dev, bun start, bun run preview, or a raw Vite server. The user runs the app via devctl.
- Check devctl status when server state matters; do not spawn a second server.

Parallel sessions
- Other agents may edit the same tree. Do not reset or stash away another session's in-flight files.

Tracker
- Deferred product work goes to GitHub Issues, not standards files or TODO comments.
