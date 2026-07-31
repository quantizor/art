aesthetic

Scope: visual design, UX, and design-system consistency in this repo.

Accessibility
- Accessibility work is deprioritized in this repo.
- Do not open WCAG remediation, audit passes, or unsolicited a11y refactors unless the user asks.
- Usability and visual polish still matter for creative scenes and the design system.

Design system sync
- When src/ui/ APIs, tokens, or component contracts change, update in the same pass:
  - src/routes/ui.tsx (/ui showcase)
  - src/ui/README.md, src/ui/INTEGRATION.md, src/ui/TAILWIND-PATTERNS.md as applicable
- Import UI components as ~/ui. Tailwind v4 via @tailwindcss/vite (see agent-docs/tailwind-css.md).

Visual verification
- Render and look at visual changes before calling them done.
- Judge from multiple zoom levels and layouts when spatial accuracy matters.
- For quantitative layout targets, measure in the render rather than nudging by eye.

Layout
- Prefer container queries for slot-sized layouts over viewport-only breakpoints when components embed in variable containers.
- Match spacing, alignment, color, and relative sizing to surrounding composition in the same edit.

Creative scenes
- GPU work follows agent-docs/threejs.md: WebGPURenderer, TSL/NodeMaterial, no WebGLRenderer or raw ShaderMaterial.
- Optical centering and material readability beat geometric box alignment when they conflict.

Copy in UI
- Controls show human labels, not raw ids or enum tokens.
- Dates, numbers, and lists use platform formatters with stable locale where values cross server and client.

Do not
- Do not ship a design-system API change without updating the /ui showcase.
- Do not block creative work on accessibility unless the user directs that work.
