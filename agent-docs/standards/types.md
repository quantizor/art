types

Scope: TypeScript across src/, scripts that ship with the app, and test code.

Strict mode
- tsconfig uses strict: true. Do not weaken compiler options to green a build.

Forbidden escapes
- No any.
- No non-null assertion (!).
- No @ts-expect-error or @ts-ignore except in a test explicitly marked as a negative type check.
- No blanket casts. Narrow with guards or reshape types at the boundary.

Preferred patterns
- Prefer unknown at boundaries, then narrow with type guards or Zod inference.
- Exported functions and components get explicit return types.
- Model fixed value sets as as const object literals plus derived union types.
- Never use TypeScript enum (runtime emit; banned by policy).

Zod
- Use Zod schemas to validate external input and infer types at boundaries.
- Do not duplicate the same shape as both a hand-written type and an unrelated schema; infer from the schema where possible.

Imports and policy
- bun run policy enforces forbidden GPU imports, bare three imports, and enum usage.
- Import Three only from three/webgpu and documented addons (see agent-docs/threejs.md).

React 19
- ref is a prop. Do not add new forwardRef wrappers.

Generated files
- Do not hand-edit src/routeTree.gen.ts or other generated artifacts; regenerate through the toolchain.
