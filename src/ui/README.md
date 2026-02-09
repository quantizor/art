# Brutalist Cyberpunk Design System

A mini design system for art portfolio speed-dial interfaces, featuring harsh brutalist aesthetics with cyberpunk-inspired red-orange accents.

## Design Principles

### Brutalist Aesthetics
- **No border-radius**: All elements have sharp, rectangular edges
- **Thick borders**: 2px default, up to 4px for emphasis
- **High contrast**: Pure black backgrounds with white text
- **Harsh transitions**: Fast, sharp animations (100-150ms)

### Cyberpunk Elements
- **Red-orange primary**: CP2077-inspired warning/danger tones
- **Glow effects**: Hover states use box-shadow glows instead of soft shadows
- **Monospace typography**: All text uses monospace fonts
- **Diagonal separators**: Visual interest through slash/cut aesthetics

### Color Philosophy
- **Background**: Pure black (#000000)
- **Primary accent**: Red-orange (#dc2626 and variants)
- **Text**: Pure white with gray secondaries
- **No gradients**: Flat color only

## File Structure

```
src/ui/
├── index.ts              # Barrel exports
├── theme.css             # CSS variables, custom properties
├── primitives/
│   └── index.ts          # Design tokens as TS constants
├── Button.tsx            # Primary action component
├── Badge.tsx             # Status/tag component
├── Card.tsx              # Content container
├── Link.tsx              # Navigation links
├── DiagonalDivider.tsx   # Separator primitive
├── ToggleGroup.tsx       # Toggle selection group
├── ButtonGroup.tsx       # Button grouping
├── examples.tsx          # Usage examples
└── README.md             # This file
```

## Installation & Setup

### 1. Import the theme CSS

Add to your root layout or main CSS file:

```tsx
// app.css or globals.css
@import '../ui/theme.css';
```

### 2. Ensure Tailwind is configured

The design system uses Tailwind CSS v4. Make sure your `tailwind.config.js` includes the UI directory:

```js
export default {
  content: [
    './src/**/*.{ts,tsx}',
  ],
};
```

### 3. Import components

```tsx
import { Button, Card, Badge, ToggleGroup } from '@/ui';
```

## Component Reference

### Button

Primary action component with multiple variants and hover glow effects.

**Variants:** `primary` | `secondary` | `ghost` | `danger`
**Sizes:** `sm` | `md` | `lg` | `xl`
**Border widths:** `default` | `thick` | `heavy`

```tsx
<Button variant="primary" size="md">
  Click Me
</Button>

<Button variant="danger" borderWidth="heavy">
  Delete
</Button>

<Button fullWidth>
  Full Width Action
</Button>
```

### Badge

Small status indicator for tags and metadata.

**Variants:** `default` | `primary` | `danger` | `warning` | `info` | `outline` | `ghost`
**Sizes:** `sm` | `md` | `lg`

```tsx
<Badge variant="primary">Featured</Badge>
<Badge variant="warning" size="sm">Beta</Badge>
<Badge variant="outline">Tag</Badge>
```

### Card

Container component for content, ideal for speed-dial items.

**Props:**
- `interactive` - Adds hover effects and cursor pointer
- `borderWidth` - Control border thickness

**Compound components:**
- `Card.Thumbnail` - Image with aspect ratio control
- `Card.Content` - Padded content container
- `Card.Title` - Uppercase brutalist title
- `Card.Meta` - Secondary metadata text
- `Card.Footer` - Footer area for badges/actions

```tsx
<Card interactive borderWidth="thick">
  <Card.Thumbnail
    src="/image.jpg"
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
```

### Link

Navigation link with brutalist styling.

**Variants:** `default` | `primary` | `ghost` | `danger`
**Underline:** `none` | `hover` | `always`

```tsx
<Link href="/portfolio" variant="primary">
  View Portfolio
</Link>

<Link href="https://example.com" external>
  External Link
</Link>
```

### ToggleGroup

Single or multi-select toggle button group with diagonal separators.

**Type:** `single` (radio-like) | `multiple` (checkbox-like)
**Variants:** `default` | `primary`
**Sizes:** `sm` | `md` | `lg`

```tsx
// Single select
const [view, setView] = useState('grid');

<ToggleGroup type="single" value={view} onValueChange={setView}>
  <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
  <ToggleGroup.Separator />
  <ToggleGroup.Item value="list">List</ToggleGroup.Item>
</ToggleGroup>

// Multi-select
const [filters, setFilters] = useState<string[]>(['featured']);

<ToggleGroup
  type="multiple"
  value={filters}
  onValueChange={setFilters}
  variant="primary"
>
  <ToggleGroup.Item value="featured">Featured</ToggleGroup.Item>
  <ToggleGroup.Separator />
  <ToggleGroup.Item value="recent">Recent</ToggleGroup.Item>
</ToggleGroup>
```

### ButtonGroup

Group related buttons with diagonal separators.

```tsx
<ButtonGroup>
  <Button variant="secondary">Edit</Button>
  <ButtonGroup.Separator />
  <Button variant="secondary">Delete</Button>
  <ButtonGroup.Separator />
  <Button variant="secondary">Share</Button>
</ButtonGroup>

// Detached group (with spacing)
<ButtonGroup attached={false}>
  <Button variant="primary">Save</Button>
  <Button variant="secondary">Cancel</Button>
</ButtonGroup>
```

### DiagonalDivider

Standalone diagonal separator primitive.

**Variants:** `default` | `thick` | `heavy`
**Colors:** `default` | `accent` | `strong`

```tsx
<DiagonalDivider variant="thick" color="accent" height="3rem" />
```

## Design Tokens

Design tokens are available as TypeScript constants and CSS custom properties.

### TypeScript Usage

```tsx
import { colors, spacing, typography } from '@/ui/primitives';

const style = {
  backgroundColor: colors.black,
  color: colors.red[500],
  padding: spacing[4],
  fontFamily: typography.fontFamily.mono,
};
```

### CSS Custom Properties

All tokens are available as CSS variables:

```css
.my-component {
  background: var(--color-surface-card);
  color: var(--color-text-primary);
  border: var(--border-width-default) solid var(--color-border-accent);
  padding: var(--spacing-4);
  font-family: var(--font-mono);
  letter-spacing: var(--tracking-wider);
}
```

### Color Palette

**Primary Red-Orange Scale:**
- `--color-red-900` through `--color-red-300`
- Primary: `#dc2626`

**Grayscale:**
- `--color-gray-950` through `--color-gray-100`
- Base: `#000000` (pure black)

**Semantic Colors:**
- `--color-surface-base` - Pure black background
- `--color-surface-card` - Card background (#171717)
- `--color-text-primary` - White text
- `--color-border-accent` - Red primary border
- `--color-primary` - Main accent color

### Typography

**Monospace Font Stack:**
```
ui-monospace, 'Cascadia Code', 'Source Code Pro',
Menlo, Consolas, 'DejaVu Sans Mono', monospace
```

**Font Sizes:**
- `xs`: 11px
- `sm`: 12px
- `base`: 14px
- `lg`: 16px
- `xl`: 20px
- `2xl`: 24px
- `3xl`: 32px

**Letter Spacing:**
- `wide`: 0.05em
- `wider`: 0.1em (default for brutalist text)
- `widest`: 0.15em

### Spacing Scale

```
1: 4px
2: 8px
3: 12px
4: 16px
5: 24px
6: 32px
8: 48px
10: 64px
```

### Border Widths

```
thin: 1px
default: 2px
thick: 3px
heavy: 4px
```

## Utility Classes

The theme provides custom utility classes:

### Surface
```css
.surface-base      /* Pure black */
.surface-card      /* Card background */
.surface-elevated  /* Slightly lighter */
```

### Borders
```css
.border-default    /* 2px gray border */
.border-accent     /* 2px red border */
.border-heavy      /* 4px border */
```

### Effects
```css
.glow-sm           /* Small red glow */
.glow-md           /* Medium red glow */
.glow-lg           /* Large red glow */
.shadow-brutal     /* 4px harsh shadow */
.shadow-brutal-lg  /* 8px harsh shadow */
```

### Typography
```css
.text-mono         /* Monospace font */
.text-brutal       /* Monospace + uppercase + wide tracking + bold */
```

### Animations
```css
.transition-brutal /* Fast, sharp transitions */
.press-effect      /* Scale down on active */
.hover-glow        /* Glow effect on hover */
```

## Animation Timing

All animations use fast, harsh timing:

- **Instant**: 50ms (immediate feedback)
- **Fast**: 100ms (press effects)
- **Normal**: 150ms (default transitions)
- **Slow**: 250ms (complex state changes)

**Easing:**
- `sharp`: cubic-bezier(0.4, 0, 0.6, 1) - Default
- `linear`: For digital/robotic effects
- `digital`: steps(4) - Stepped animations

## Accessibility

All components include:

- ✅ Proper ARIA attributes
- ✅ Keyboard navigation support
- ✅ Focus visible states with 2px primary ring
- ✅ Semantic HTML elements
- ✅ Sufficient color contrast (WCAG AAA on black)

## Customization

### Extending Components

All components export their CVA variant configurations:

```tsx
import { buttonVariants } from '@/ui';

// Create custom button variant
const customButton = buttonVariants({
  variant: 'primary',
  size: 'lg',
  className: 'my-custom-class',
});
```

### Theme Overrides

Override CSS custom properties in your own CSS:

```css
:root {
  /* Use a different primary color */
  --color-primary: #ff6b35;
  --color-primary-hover: #ff8555;
  --color-primary-glow: #ff6b35;
}
```

### Adding New Variants

Extend existing components:

```tsx
import { Button, type ButtonProps } from '@/ui';

function IconButton({ icon, ...props }: ButtonProps & { icon: ReactNode }) {
  return (
    <Button {...props}>
      {icon}
    </Button>
  );
}
```

## Examples

See `examples.tsx` for comprehensive usage examples including:

- All component variations
- Common patterns
- Speed dial interface example
- Composition patterns

## Best Practices

### Do's ✅
- Use semantic tokens (e.g., `--color-primary`) instead of primitive values
- Always use uppercase text for titles with `.text-brutal`
- Leverage diagonal separators in compound components
- Use `interactive` prop on cards for clickable items
- Maintain 2px minimum border width for brutalist feel

### Don'ts ❌
- Don't add border-radius (enforced via CSS)
- Don't use soft shadows (use glow effects instead)
- Don't mix sans-serif fonts (monospace only)
- Don't use gradients (flat colors only)
- Don't skip the hover glow on interactive primary elements

## Performance Notes

- All transitions use GPU-accelerated properties (transform, opacity)
- Images in cards use `loading="lazy"`
- SVG icons are inline for instant rendering
- No external font files (system monospace fonts only)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS custom properties required
- Flexbox and Grid required
- No IE11 support

---

**Design System Version:** 1.0.0
**Created for:** TanStack Start + React 19 + Tailwind CSS v4
**Aesthetic:** Brutalist Cyberpunk
