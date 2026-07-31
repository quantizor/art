testing

Scope: unit and integration tests run with Bun in this repo.

Runner
- Use bun test for the whole tree. Do not run a narrowed path that silently skips suites.
- Local gate: bun run verify (typecheck, lint, policy, test, build). No CI in this repo.

Coverage
- Coverage is not measured or gated here.
- Do not add coverage thresholds, coverage reporting, or a second test runner for branch metrics.
- Judge a test by whether it can fail for the reason that matters.

TDD
- Practice TDD where possible: failing test, minimal green, refactor.
- Ship tests with every behavior change in the same pass as the change.

What to test
- Happy paths, empty/null inputs, edges, and failure modes.
- Prefer pure engine logic without Three.js or React.
- Mock DOM or Three when a component or renderer must be tested.

What not to test
- Do not snapshot brittle output (CSS class strings, full markup) unless the unit under test owns that exact contract.
- Do not add tests that only assert types or trivial getters with no behavior.

Validation
- Run bun test after substantive edits.
- A skipped or unrun test is an open question, not a pass.

Fixtures
- Prefer full-output assertions with normalized volatile fields (timestamps, ids) over needle-in-a-haystack substring checks.
