# TanStack Start Integration Guide

How this design system is wired into the app. Paths and tooling match the repo as it ships.

## Setup in this project

### 1. Dependencies

Installed via Bun:

```bash
bun add class-variance-authority
```

### 2. Theme CSS

`src/styles/app.css` imports Tailwind v4 and the theme:

```css
@import 'tailwindcss' source('../');
@import '../ui/theme.css';
```

The root route imports `~/styles/app.css`. There is no `tailwind.config.js`; Tailwind runs through `@tailwindcss/vite` in `vite.config.ts`.

### 3. Path alias

`tsconfig.json` maps `~/` to `./src/`:

```json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./src/*"]
    }
  }
}
```

Import UI components as `~/ui`, never `@/ui`.

## Usage in routes

```tsx
import { Card, Button, Badge, ToggleGroup } from '~/ui'
import { useState } from 'react'

export default function HomePage() {
  const [view, setView] = useState('grid')

  return (
    <div className="min-h-screen surface-base p-8">
      <header className="mb-8">
        <h1 className="text-brutal text-3xl text-[var(--color-primary)] mb-4">
          MY PORTFOLIO
        </h1>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={setView}
          variant="primary"
        >
          <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
          <ToggleGroup.Separator />
          <ToggleGroup.Item value="list">List</ToggleGroup.Item>
        </ToggleGroup>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card interactive>
          <Card.Thumbnail src="/thumbnails/tension.png" alt="Tension" />
          <Card.Content>
            <Card.Title>Tension</Card.Title>
            <Card.Meta>Generative</Card.Meta>
          </Card.Content>
        </Card>
      </div>
    </div>
  )
}
```

## SSR notes

- Components are isomorphic. Avoid `window` / `localStorage` at module scope.
- Theme tokens are CSS variables on `:root`; no client-only theme provider is required for the default dark surface.
- GPU canvases (projects, lightcycle 404) must initialize only in client effects after mount.

## Showcase sync

When `src/ui/` APIs or tokens change, update `src/routes/ui.tsx` and this folder's docs in the same pass. The `/ui` route is the living documentation.

## Troubleshooting

- Wrong import path: use `~/ui`, not `@/ui`.
- Missing styles: confirm `app.css` imports `theme.css` and `@tailwindcss/vite` is in `vite.config.ts`.
- Class conflicts: compose with CVA variants the way existing components do, rather than concatenating conflicting utilities. See `TAILWIND-PATTERNS.md`.
