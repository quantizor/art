# Modern CSS (2024-2026)

Cutting-edge CSS features. Use progressive enhancement and feature queries for production.

## Scroll-Driven Animations

Animate elements based on scroll position instead of time. No JavaScript required.

```css
/* Named scroll timeline on a scroll container */
.scroll-container {
  scroll-timeline: --main-timeline block;
}

/* Animate element based on container's scroll */
.animated-element {
  animation: slide-in linear;
  animation-timeline: --main-timeline;
}

/* Anonymous scroll timeline (self or nearest scroller) */
.self-scroll {
  animation: fade-in linear;
  animation-timeline: scroll(block);  /* or scroll(inline) */
}
```

### View Timeline (element visibility in viewport)

```css
/* Create timeline based on element entering/leaving scrollport */
section {
  view-timeline: --section-timeline block;
}

section h2 {
  animation: rise 1s ease-out forwards;
  animation-timeline: --section-timeline;
  animation-range: entry 0% cover 30%;  /* when to animate */
}

@keyframes rise {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Animation Range Values
- `entry` - Element entering scrollport
- `cover` - Element fully covering scrollport
- `contain` - Element fully contained in scrollport
- `exit` - Element leaving scrollport

```css
animation-range: entry 0% cover 50%;
animation-range-start: entry 25%;
animation-range-end: exit 75%;
```

## Container Queries

Style elements based on their container's size, not the viewport.

```css
/* Establish a size query container */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* Query the container */
@container card (min-width: 400px) {
  .card-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

/* Shorthand */
.container {
  container: sidebar / inline-size;
}
```

## Scroll-State Container Queries (Chrome 133+)

Query sticky/snapped/scrolled states natively.

```css
/* Establish scroll-state container */
.sticky-header {
  position: sticky;
  top: 0;
  container-type: scroll-state;
}

/* Style when stuck */
@container scroll-state(stuck: top) {
  .sticky-header {
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-bottom: 2px solid var(--accent);
  }
}

/* Snap container queries */
@container scroll-state(snapped: x) {
  .carousel-item { opacity: 1; }
}
```

## The :has() Selector (Parent Selector)

Select parent elements based on their children.

```css
/* Style card that contains an image */
.card:has(img) {
  padding: 0;
}

/* Style form with invalid inputs */
form:has(:invalid) {
  border-color: red;
}

/* Style label when adjacent input is focused */
label:has(+ input:focus) {
  color: var(--accent);
}

/* Conditional layout based on content */
.grid:has(> :nth-child(4)) {
  grid-template-columns: repeat(2, 1fr);
}
```

## CSS Nesting

Native CSS nesting without preprocessors.

```css
.card {
  background: white;

  & .title {
    font-size: 1.5rem;
  }

  &:hover {
    background: #f5f5f5;
  }

  @media (width >= 768px) {
    padding: 2rem;
  }
}
```

## @scope

Scope styles to a DOM subtree without specificity issues.

```css
@scope (.card) to (.card__footer) {
  /* Only applies between .card and .card__footer */
  :scope {
    padding: 1rem;
  }

  .button {
    font-weight: 600;
  }
}
```

## @starting-style

Define initial styles for enter transitions (fixes the "flash" problem).

```css
.toast {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 200ms, transform 200ms;
}

@starting-style {
  .toast {
    opacity: 0;
    transform: translateY(12px);
  }
}
```

## @layer

Control cascade order explicitly.

```css
@layer reset, base, components, utilities;

@layer reset {
  * { margin: 0; box-sizing: border-box; }
}

@layer components {
  .button { /* component styles */ }
}

@layer utilities {
  .hidden { display: none !important; }
}
```

## Modern Color Functions

```css
:root {
  /* OKLCH - perceptually uniform color space */
  --brand: oklch(0.62 0.16 35);

  /* Derive colors with relative syntax */
  --brand-light: oklch(from var(--brand) calc(l + 0.2) c h);
  --brand-dark: oklch(from var(--brand) calc(l - 0.1) c h);

  /* Mix colors */
  --brand-soft: color-mix(in oklch, var(--brand), white 65%);

  /* Light/dark mode in one declaration */
  --surface: light-dark(#ffffff, #0a0a0a);
  --text: light-dark(#171717, #fafafa);
}

/* Enable light-dark() */
:root { color-scheme: light dark; }
```

## Anchor Positioning

Position elements relative to an "anchor" element without JavaScript.

```css
/* Define an anchor */
.trigger {
  anchor-name: --tooltip-anchor;
}

/* Position relative to anchor */
.tooltip {
  position: fixed;
  position-anchor: --tooltip-anchor;

  /* Position using anchor() function */
  top: anchor(bottom);
  left: anchor(center);
  translate: -50% 8px;

  /* Or use position-area for common patterns */
  position-area: bottom center;
}
```

## @property (Typed Custom Properties)

Define custom properties with types for animation.

```css
@property --hue {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.element {
  --hue: 0deg;
  background: hsl(var(--hue), 80%, 50%);
  transition: --hue 500ms;
}

.element:hover {
  --hue: 180deg;  /* Now animatable! */
}
```

## Typed attr()

Use HTML attributes as typed CSS values.

```css
/* Use data-* attributes with type casting */
.badge {
  --hue: attr(data-hue type(<number>));
  background: oklch(0.72 0.18 calc(var(--hue) * 1deg));
}

.progress {
  width: attr(data-percent type(<percentage>), 0%);
}
```

## sibling-index() and sibling-count()

Create staggered animations without extra classes.

```css
.list-item {
  /* Auto-stagger based on DOM position */
  transition-delay: calc((sibling-index() - 1) * 40ms);
  animation-delay: calc(sibling-index() * 50ms);
}

/* Use total count */
.grid-item {
  flex-basis: calc(100% / sibling-count());
}
```

## Typography

```css
/* Prevent orphans in headings */
h1, h2, h3 {
  text-wrap: balance;
}

/* Better paragraph wrapping */
p {
  text-wrap: pretty;
}

/* Initial letter drop cap */
p::first-letter {
  initial-letter: 3;  /* Spans 3 lines */
}
```

## Subgrid

Child grids inherit parent grid tracks.

```css
.parent {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.child {
  display: grid;
  grid-column: span 3;
  grid-template-columns: subgrid;  /* Inherits parent columns */
}
```

## View Transitions

Smooth transitions between page states or navigations.

```css
/* Enable view transitions */
@view-transition {
  navigation: auto;
}

/* Name elements for cross-page transitions */
.hero-image {
  view-transition-name: hero;
}

/* Customize transition animation */
::view-transition-old(hero) {
  animation: fade-out 200ms;
}

::view-transition-new(hero) {
  animation: fade-in 200ms;
}
```

---

## Browser Support

| Feature | Chrome | Firefox | Safari |
|---------|--------|---------|--------|
| Nesting | 120+ | 117+ | 17.2+ |
| :has() | 105+ | 121+ | 15.4+ |
| Container Queries | 105+ | 110+ | 16+ |
| Scroll-driven Animations | 115+ | -- | -- |
| @scope | 118+ | -- | 17.4+ |
| @layer | 99+ | 97+ | 15.4+ |
| @starting-style | 117+ | -- | 17.5+ |
| Anchor Positioning | 125+ | -- | -- |
| View Transitions | 111+ | -- | 18+ |
| Popover API | 114+ | 125+ | 17+ |
| Customizable Select | 135+ | -- | -- |

## Feature Detection

```css
/* Scroll-driven animations */
@supports (animation-timeline: scroll()) {
  /* Use scroll-driven animations */
}

/* Container queries */
@supports (container-type: inline-size) {
  /* Use container queries */
}

/* :has() selector */
@supports selector(:has(*)) {
  /* Use :has() */
}
```

## Do's and Don'ts

| DO | DON'T |
|----|-------|
| Use `@layer` to manage cascade order | Fight specificity with !important |
| Use `:has()` for parent-based styling | Use JavaScript for parent selectors |
| Use `@starting-style` for enter animations | Accept the "flash" on element creation |
| Use `scroll-timeline` for scroll-linked animations | Use IntersectionObserver for simple scroll effects |
| Use `color-mix()` for derived colors | Manually calculate color variations |
| Use `appearance: base-select` for styled selects | Build custom select components from scratch |
| Feature-detect before using cutting-edge CSS | Assume browser support |
| Use `view-timeline` for reveal animations | Use JavaScript scroll listeners |
