# TanStack Start Integration Guide

Quick guide for integrating the Brutalist Cyberpunk Design System into your TanStack Start + React 19 application.

## Setup Steps

### 1. Install Dependencies

```bash
npm install class-variance-authority clsx tailwind-merge
```

### 2. Import Theme CSS

In your root route or main CSS file (e.g., `app/root.tsx` or `app.css`):

```tsx
// app.css or app/styles.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import '../ui/theme.css';
```

Then import the CSS in your root component:

```tsx
// app/root.tsx
import './app.css';
```

### 3. Configure Tailwind

Ensure your `tailwind.config.ts` includes the UI directory:

```ts
import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

### 4. Create Path Alias (Optional but Recommended)

In your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/ui": ["./src/ui"],
      "@/ui/*": ["./src/ui/*"]
    }
  }
}
```

## Usage in Routes

### Basic Page with Cards

```tsx
// app/routes/index.tsx
import { Card, Button, Badge, ToggleGroup } from '@/ui';
import { useState } from 'react';

export default function HomePage() {
  const [view, setView] = useState('grid');

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
        <Card interactive borderWidth="thick">
          <Card.Thumbnail
            src="/images/project-1.jpg"
            alt="Project"
            aspectRatio="16/9"
          />
          <Card.Content>
            <Card.Title>Project Name</Card.Title>
            <Card.Meta>2024 • Digital Art</Card.Meta>
          </Card.Content>
          <Card.Footer>
            <Badge variant="primary" size="sm">Featured</Badge>
          </Card.Footer>
        </Card>
      </div>
    </div>
  );
}
```

### Speed Dial Interface

```tsx
// app/routes/speed-dial.tsx
import { Card, Badge, ToggleGroup, ButtonGroup, Button } from '@/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/speed-dial')({
  component: SpeedDialPage,
});

function SpeedDialPage() {
  const [filter, setFilter] = useState<string[]>(['all']);

  const sites = [
    {
      id: 1,
      title: 'Portfolio',
      url: 'portfolio.dev',
      shortcut: 'P1',
      tags: ['Featured'],
    },
    // ... more sites
  ];

  return (
    <div className="min-h-screen surface-base p-8">
      <header className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-brutal text-3xl text-[var(--color-primary)]">
            SPEED DIAL
          </h1>

          <ButtonGroup>
            <Button variant="secondary">New</Button>
            <ButtonGroup.Separator />
            <Button variant="secondary">Settings</Button>
          </ButtonGroup>
        </div>

        <ToggleGroup
          type="multiple"
          value={filter}
          onValueChange={(v) => setFilter(v as string[])}
          variant="primary"
        >
          <ToggleGroup.Item value="all">All</ToggleGroup.Item>
          <ToggleGroup.Separator />
          <ToggleGroup.Item value="featured">Featured</ToggleGroup.Item>
          <ToggleGroup.Separator />
          <ToggleGroup.Item value="recent">Recent</ToggleGroup.Item>
        </ToggleGroup>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sites.map((site) => (
          <Card
            key={site.id}
            interactive
            borderWidth="heavy"
            onClick={() => window.location.href = `/${site.url}`}
          >
            <Card.Content>
              <div className="flex items-start justify-between">
                <div>
                  <Card.Title>{site.title}</Card.Title>
                  <Card.Meta>{site.url}</Card.Meta>
                </div>
                <Badge variant="primary" size="sm">
                  {site.shortcut}
                </Badge>
              </div>
            </Card.Content>
            <Card.Footer>
              {site.tags.map((tag) => (
                <Badge key={tag} variant="outline" size="sm">
                  {tag}
                </Badge>
              ))}
            </Card.Footer>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### Layout with Navigation

```tsx
// app/routes/__layout.tsx
import { Link, ButtonGroup, Button } from '@/ui';
import { Outlet } from '@tanstack/react-router';

export default function Layout() {
  return (
    <div className="min-h-screen surface-base">
      {/* Navigation */}
      <nav className="border-b border-[var(--color-border-default)] border-b-[var(--border-width-default)] px-8 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" variant="primary" underline="none">
            <h1 className="text-brutal text-xl">ART PORTFOLIO</h1>
          </Link>

          <ButtonGroup>
            <Link href="/portfolio">
              <Button variant="ghost">Portfolio</Button>
            </Link>
            <ButtonGroup.Separator />
            <Link href="/about">
              <Button variant="ghost">About</Button>
            </Link>
            <ButtonGroup.Separator />
            <Link href="/contact">
              <Button variant="secondary">Contact</Button>
            </Link>
          </ButtonGroup>
        </div>
      </nav>

      {/* Page content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

## Working with TanStack Router

### Using with Links

The design system `Link` component works alongside TanStack Router's `Link`:

```tsx
import { Link as RouterLink } from '@tanstack/react-router';
import { linkVariants } from '@/ui';

// Option 1: Use RouterLink with linkVariants
<RouterLink
  to="/portfolio"
  className={linkVariants({ variant: 'primary', size: 'lg' })}
>
  Portfolio
</RouterLink>

// Option 2: Wrap Button in RouterLink
<RouterLink to="/portfolio">
  <Button variant="primary">View Portfolio</Button>
</RouterLink>
```

### Dynamic Routes with Cards

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@/ui';

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();

  return (
    <div className="surface-base p-8">
      <Card borderWidth="thick">
        <Card.Content>
          <Card.Title>Project {projectId}</Card.Title>
          {/* ... */}
        </Card.Content>
      </Card>
    </div>
  );
}
```

## Server-Side Rendering (SSR)

The design system is SSR-compatible out of the box:

- All CSS is static (no runtime CSS-in-JS)
- No client-side JavaScript required for styling
- Uses CSS custom properties for theming
- Components work with React 19 server components

## Performance Tips

### Code Splitting

Import only what you need:

```tsx
// Good - tree-shakeable
import { Button, Card } from '@/ui';

// Avoid - imports everything
import * as UI from '@/ui';
```

### Image Optimization

Use TanStack Start's image optimization with Card thumbnails:

```tsx
<Card.Thumbnail
  src={optimizeImage('/images/project.jpg', { width: 400, format: 'webp' })}
  alt="Project"
  aspectRatio="16/9"
/>
```

### Lazy Loading

For large lists of cards:

```tsx
import { lazy, Suspense } from 'react';

const HeavyCard = lazy(() => import('./components/HeavyCard'));

<Suspense fallback={<Card>Loading...</Card>}>
  <HeavyCard />
</Suspense>
```

## Dark Mode (Already Built In)

The design system uses pure black as default. No dark mode toggle needed, but if you want to add a light theme:

```css
/* In your app.css */
.light-theme {
  --color-surface-base: var(--color-gray-100);
  --color-surface-card: var(--color-pure-white);
  --color-text-primary: var(--color-black);
  --color-border-default: var(--color-gray-300);
}
```

Apply conditionally:

```tsx
<html className={theme === 'light' ? 'light-theme' : ''}>
  {/* ... */}
</html>
```

## Troubleshooting

### Styles Not Applying

1. Check that `theme.css` is imported in your root CSS
2. Verify Tailwind is processing the UI directory
3. Ensure no conflicting global styles

### TypeScript Errors

1. Check path aliases in `tsconfig.json`
2. Restart TypeScript server in your editor
3. Verify all peer dependencies are installed

### Border Radius Appearing

The theme enforces `border-radius: 0` globally. If you see rounded corners:

1. Check for conflicting Tailwind utilities
2. Verify `theme.css` is loaded after Tailwind base styles
3. Clear browser cache

## Next Steps

1. Review `examples.tsx` for comprehensive usage patterns
2. Customize color tokens in `theme.css` for your brand
3. Add new components following the established CVA patterns
4. Check `README.md` for full component API documentation

---

**Need Help?** See the main README.md for detailed component documentation.
