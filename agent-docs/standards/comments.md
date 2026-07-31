comments

Scope: inline comments, JSDoc on exports, and design notes that ship beside code.

Purpose
- Comments explain why and non-obvious current behavior as the code stands now.
- Do not narrate what changed, what used to happen, or ticket numbers unless the ticket is the permanent external spec.

Exports
- Exported functions, types, components, and constants get hover-friendly documentation (JSDoc or equivalent).
- Document parameters, return value, and thrown errors when non-obvious.

When to comment
- Non-obvious ordering, magic numbers with domain meaning, or branches that look wrong but are intentional.
- GPU lifecycle, worker protocol tags, and SSR/client split seams.
- Intentional suppressions in negative tests: mark them as negative tests, not production escapes.

When not to comment
- Do not restate what the code already says (// increment i).
- Do not leave TODO comments in place of a GitHub Issue for deferred product work.

Design docs
- Settled designs are documented before implementation when the behavior is not obvious from types alone.
- UI design system changes also update src/routes/ui.tsx and src/ui/*.md in the same pass (see aesthetic.md).

Agent docs
- Standards belong in agent-docs/standards/, not in long comment blocks at the top of source files.
