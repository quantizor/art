# Tailwind CSS Patterns for Brutalist Cyberpunk Design System

Quick reference for common Tailwind class combinations used throughout the design system.

## Core Patterns

### Brutalist Text
```tsx
className="text-mono font-bold uppercase tracking-[var(--tracking-wider)]"
// Shorthand utility:
className="text-brutal"
```

### Surface Backgrounds
```tsx
// Base (pure black)
className="bg-[var(--color-surface-base)]"
// or
className="surface-base"

// Card background
className="bg-[var(--color-surface-card)]"
// or
className="surface-card"

// Elevated (hover state)
className="bg-[var(--color-surface-elevated)]"
// or
className="surface-elevated"
```

### Borders
```tsx
// Default brutalist border (2px gray)
className="border-solid border-[var(--color-border-default)] border-[var(--border-width-default)]"
// or
className="border-solid border-default"

// Accent border (red-orange)
className="border-solid border-[var(--color-border-accent)] border-[var(--border-width-default)]"
// or
className="border-solid border-accent"

// Thick borders
className="border-[var(--border-width-thick)]"
className="border-[var(--border-width-heavy)]"
```

### Interactive States
```tsx
// Hover with glow
className="transition-brutal hover-glow"

// Press effect
className="press-effect"

// Combined
className="transition-brutal hover-glow press-effect cursor-pointer"
```

### Text Colors
```tsx
// Primary text (white)
className="text-[var(--color-text-primary)]"

// Secondary text (gray)
className="text-[var(--color-text-secondary)]"

// Tertiary text (darker gray)
className="text-[var(--color-text-tertiary)]"

// Primary accent (red-orange)
className="text-[var(--color-primary)]"
```

### Spacing
```tsx
// Padding
className="p-[var(--spacing-4)]"      // 16px all sides
className="px-[var(--spacing-4)]"     // 16px horizontal
className="py-[var(--spacing-2)]"     // 8px vertical

// Gap
className="gap-[var(--spacing-2)]"    // 8px gap
className="gap-[var(--spacing-4)]"    // 16px gap

// Margin
className="mb-[var(--spacing-6)]"     // 32px bottom margin
```

## Common Component Patterns

### Container
```tsx
<div className="min-h-screen surface-base p-8">
  {/* content */}
</div>
```

### Header Section
```tsx
<header className="mb-8">
  <h1 className="text-brutal text-3xl text-[var(--color-primary)] mb-4">
    PAGE TITLE
  </h1>
</header>
```

### Grid Layout
```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* items */}
</div>

// Speed dial grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {/* items */}
</div>
```

### Flex Layouts
```tsx
// Horizontal group
<div className="flex items-center gap-4">
  {/* items */}
</div>

// Space between
<div className="flex items-center justify-between">
  {/* items */}
</div>

// Vertical stack
<div className="flex flex-col gap-2">
  {/* items */}
</div>
```

### Interactive Card Surface
```tsx
<div className="surface-card border-solid border-default transition-brutal hover-glow press-effect cursor-pointer hover:surface-elevated hover:border-accent">
  {/* content */}
</div>
```

### Focus States
```tsx
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-[var(--color-surface-base)]"
```

## Typography Patterns

### Page Title
```tsx
<h1 className="text-brutal text-3xl text-[var(--color-primary)]">
  TITLE
</h1>
```

### Section Heading
```tsx
<h2 className="text-brutal text-xl text-[var(--color-text-primary)] mb-4">
  SECTION
</h2>
```

### Card Title
```tsx
<h3 className="text-brutal text-base text-[var(--color-text-primary)] leading-tight">
  CARD TITLE
</h3>
```

### Metadata Text
```tsx
<p className="text-mono text-xs text-[var(--color-text-secondary)] tracking-[var(--tracking-wide)]">
  2024 • Digital Art • Featured
</p>
```

### Body Text
```tsx
<p className="text-mono text-sm text-[var(--color-text-primary)] leading-normal">
  Regular paragraph text
</p>
```

## Transition Patterns

### Default Transition
```tsx
className="transition-all duration-[var(--duration-fast)] ease-[var(--ease-sharp)]"
// or
className="transition-brutal"
```

### Hover Glow Transition
```tsx
className="transition-[box-shadow] duration-[var(--duration-normal)] ease-[var(--ease-sharp)]"
// or
className="hover-glow"
```

### Press Effect
```tsx
className="transition-transform duration-[var(--duration-fast)] active:scale-[0.98]"
// or
className="press-effect"
```

## Shadow/Glow Patterns

### Hover Glow
```tsx
// Small glow
className="hover:shadow-[0_0_8px_var(--color-primary-glow)]"
// or
className="hover:glow-sm"

// Medium glow (default interactive)
className="hover:shadow-[0_0_16px_var(--color-primary-glow)]"
// or
className="hover:glow-md"

// Large glow (emphasis)
className="hover:shadow-[0_0_24px_var(--color-primary-glow)]"
// or
className="hover:glow-lg"
```

### Brutal Shadows
```tsx
// Small harsh shadow
className="shadow-[4px_4px_0_var(--color-gray-900)]"
// or
className="shadow-brutal"

// Large harsh shadow
className="shadow-[8px_8px_0_var(--color-gray-900)]"
// or
className="shadow-brutal-lg"
```

## Responsive Patterns

### Breakpoint Usage
```tsx
// Mobile first approach
className="
  flex-col              // Mobile: stack vertically
  md:flex-row           // Tablet+: horizontal
  lg:gap-8              // Desktop: larger gap
  xl:grid-cols-4        // Wide: 4 columns
"
```

### Common Responsive Grids
```tsx
// 1 -> 2 -> 3
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"

// 1 -> 2 -> 3 -> 4 (speed dial)
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
```

### Responsive Spacing
```tsx
className="
  p-4                   // Mobile: 16px padding
  md:p-6                // Tablet: 32px padding
  lg:p-8                // Desktop: 48px padding
"
```

## Disabled States

```tsx
className="disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
```

## Accessibility Patterns

### Keyboard Focus
```tsx
className="
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-[var(--color-primary)]
  focus-visible:ring-offset-2
  focus-visible:ring-offset-[var(--color-surface-base)]
"
```

### Screen Reader Only
```tsx
<span className="sr-only">
  Accessible label
</span>
```

## Composition Examples

### Interactive Button
```tsx
<button className="
  inline-flex items-center justify-center gap-2
  h-10 px-4
  bg-[var(--color-primary)] text-[var(--color-text-inverse)]
  border-solid border-[var(--color-primary)] border-[var(--border-width-default)]
  text-mono text-brutal text-sm
  transition-brutal hover-glow press-effect
  cursor-pointer select-none
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Click Me
</button>
```

### Card Container
```tsx
<div className="
  surface-card
  border-solid border-default
  overflow-hidden
  flex flex-col
  transition-brutal hover-glow
  hover:surface-elevated hover:border-accent
  press-effect cursor-pointer
">
  {/* Card content */}
</div>
```

### Navigation Bar
```tsx
<nav className="
  border-b border-[var(--color-border-default)] border-b-[var(--border-width-default)]
  px-8 py-4
  surface-base
">
  <div className="flex items-center justify-between">
    {/* Nav content */}
  </div>
</nav>
```

## Pro Tips

### Prefer Utility Classes Over Custom Properties
```tsx
// Good - uses utility classes where possible
className="surface-card border-accent glow-md text-brutal"

// Also good - semantic tokens for custom values
className="bg-[var(--color-surface-card)] border-[var(--color-border-accent)]"

// Avoid - raw values
className="bg-[#171717] border-[#dc2626]"
```

### Combine with CVA for Reusable Patterns
```tsx
import { cva } from 'class-variance-authority';

const buttonStyle = cva('transition-brutal hover-glow press-effect', {
  variants: {
    variant: {
      primary: 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]',
      secondary: 'border-default text-[var(--color-text-primary)]',
    },
  },
});
```

### Use Arbitrary Values with CSS Variables
```tsx
// Arbitrary values work with CSS custom properties
className="
  h-[var(--spacing-10)]
  text-[var(--text-lg)]
  border-[var(--border-width-heavy)]
"
```

---

**Remember:** The design system enforces `border-radius: 0` globally. No need to add it to components.
