# Tailwind CSS

Version pins: `tailwindcss` **4.1.x**, `@tailwindcss/vite` **4.1.x**.

Primary setup is Tailwind v4 through the Vite plugin. There is no checked-in `tailwind.config.js` / `tailwind.config.ts` as the source of truth.

## Vite integration

`vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    // ...
  ],
})
```

Verified: `@tailwindcss/vite@4.1.18` in devDependencies; plugin registered in project `vite.config.ts`.

## CSS entry

`src/styles/app.css` is the Tailwind entry imported from `src/routes/__root.tsx`:

```css
@import 'tailwindcss' source('../');
@import '../ui/theme.css';
```

Do:

- Put global base layers and app-wide utilities in `src/styles/app.css`.
- Put design tokens and component variables in `src/ui/theme.css`.
- Use `@layer base` / `@layer utilities` when ordering matters.

Do not:

- Add a v3-style `@tailwind base; @tailwind components; @tailwind utilities;` block as the primary setup.
- Treat a hand-written `tailwind.config.js` content array as required. v4 discovers sources via `@import 'tailwindcss' source(...)` and on-disk CSS.
- Copy v3 `theme.extend` snippets without converting to v4 `@theme` / CSS variables (see `src/ui/theme.css` and `src/ui/TAILWIND-PATTERNS.md`).

## Import path alias

TypeScript maps `~/*` to `./src/*` (`tsconfig.json`).

Do:

```tsx
import { Button, Link } from '~/ui'
import { NotFound } from '~/components/NotFound'
```

Do not:

- Use `@/ui` or `@/*` in new code. The repo alias is `~/`, not `@/`.
- Deep-import UI internals when `~/ui` barrel exports cover the symbol.

## Design system

Living docs:

- Route: `/ui` (`src/routes/ui.tsx`)
- `src/ui/README.md`, `src/ui/INTEGRATION.md`, `src/ui/TAILWIND-PATTERNS.md`

When changing `src/ui/` component APIs or tokens, update the `/ui` showcase and adjacent UI docs in the same pass.

## Utilities in components

- Compose variants with `class-variance-authority` following existing `src/ui/` patterns, rather than concatenating utilities that fight each other.
- Prefer CSS variables from `theme.css` (`var(--color-primary)`) over hard-coded hex in route files.
- Prefer container queries (`@container`) for slot-sized layouts inside project viewers.
