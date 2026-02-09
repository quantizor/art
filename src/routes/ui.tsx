/**
 * Design System Showcase
 *
 * Displays all UI components from the brutalist cyberpunk design system.
 * Features a sticky TOC sidebar with scroll-spy highlighting.
 */

import { createFileRoute, Link as RouterLink } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardTitle,
  CardMeta,
  CardFooter,
  Link,
  ToggleGroup,
  ButtonGroup,
  DiagonalDivider,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Slider,
  ColorInput,
  DateInput,
  Tooltip,
} from '~/ui';

export const Route = createFileRoute('/ui')({
  component: DesignSystemShowcase,
});

// Section definitions for TOC
const sections = [
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'badges', label: 'Badges' },
  { id: 'cards', label: 'Cards' },
  { id: 'links', label: 'Links' },
  { id: 'tooltips', label: 'Tooltips' },
  { id: 'form-inputs', label: 'Form Inputs' },
  { id: 'toggle-groups', label: 'Toggle Groups' },
  { id: 'button-groups', label: 'Button Groups' },
  { id: 'dividers', label: 'Dividers' },
];

function DesignSystemShowcase() {
  const [activeSection, setActiveSection] = useState<string>('colors');
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Create IntersectionObserver for scroll-spy
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the first visible section from top
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by boundingClientRect.top to get topmost visible section
          const topmost = visibleEntries.reduce((prev, curr) =>
            prev.boundingClientRect.top < curr.boundingClientRect.top ? prev : curr
          );
          setActiveSection(topmost.target.id);
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px', // Trigger when section enters top 40% of viewport
        threshold: 0,
      }
    );

    // Observe all sections
    sections.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element && observerRef.current) {
        observerRef.current.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const activeLabel = sections.find((s) => s.id === activeSection)?.label || 'Contents';

  const handleNavClick = (id: string) => {
    setIsMobileTocOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-8">
        <RouterLink
          to="/"
          className="text-display text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mb-8 inline-block"
        >
          &larr; Back to Home
        </RouterLink>
        <h1 className="text-4xl sm:text-5xl text-[var(--color-text-primary)] mb-2 normal-case">
          design system
        </h1>
        <p className="text-display text-[var(--color-text-secondary)] max-w-2xl">
          Brutalist cyberpunk UI components. No border-radius. Harsh borders. Saturation-based hovers.
        </p>
      </header>

      {/* Mobile TOC - Floating collapsible on right */}
      <div className="lg:hidden fixed top-4 sm:top-6 right-4 sm:right-6 z-40">
        <div className="bg-black/70 backdrop-blur-md overflow-hidden transition-all duration-200 ease-out">
          <button
            onClick={() => setIsMobileTocOpen(!isMobileTocOpen)}
            className="flex items-center justify-end gap-1.5 px-3 h-7 text-display text-xs text-[var(--color-primary)] cursor-pointer leading-none w-full"
          >
            <span>{activeLabel}</span>
            <ChevronIcon className={`w-2.5 h-2.5 transition-transform duration-200 ${isMobileTocOpen ? 'rotate-180' : ''}`} />
          </button>
          <nav
            className={`grid transition-all duration-200 ease-out ${
              isMobileTocOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <ul className="flex flex-col overflow-hidden">
              {sections.map(({ id, label }, index) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`block px-3 py-1 text-display text-xs transition-colors text-right cursor-pointer ${
                      index === sections.length - 1 ? 'pb-2' : ''
                    } ${
                      activeSection === id
                        ? 'text-[var(--color-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(id);
                    }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content with sidebar */}
      <div className="flex gap-8 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8">
        {/* TOC Sidebar - Desktop (left side) */}
        <aside className="hidden lg:block w-48 shrink-0">
          <nav className="sticky top-8">
            <h2 className="text-display text-xs font-medium uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-tertiary)] mb-4">
              Contents
            </h2>
            <ul className="flex flex-col gap-1">
              {sections.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`block py-1.5 px-3 text-display text-sm transition-colors border-l ${
                      activeSection === id
                        ? 'text-[var(--color-primary)] border-[var(--color-primary)] bg-[var(--color-surface-card)]'
                        : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-default)]'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(id);
                    }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="flex flex-col gap-16">
            <ColorPaletteSection />
            <TypographySection />
            <ButtonSection />
            <BadgeSection />
            <CardSection />
            <LinkSection />
            <TooltipSection />
            <FormInputsSection />
            <ToggleGroupSection />
            <ButtonGroupSection />
            <DiagonalDividerSection />
          </div>
        </main>
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="square" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SectionHeader({ id, title, description }: { id: string; title: string; description?: string }) {
  return (
    <div id={id} className="mb-6 pb-4 border-b border-[var(--color-border-default)] scroll-mt-16 lg:scroll-mt-8">
      <h2 className="text-brutal text-xl sm:text-2xl text-[var(--color-text-primary)]">{title}</h2>
      {description && (
        <p className="text-display text-sm text-[var(--color-text-secondary)] mt-1">{description}</p>
      )}
    </div>
  );
}

function ColorPaletteSection() {
  const colors = [
    { name: 'Primary', value: 'var(--color-primary)', hex: '#ea580c' },
    { name: 'Primary Hover', value: 'var(--color-primary-hover)', hex: '#f97316' },
    { name: 'Surface Base', value: 'var(--color-surface-base)', hex: '#000000' },
    { name: 'Surface Card', value: 'var(--color-surface-card)', hex: '#0a0a0a' },
    { name: 'Border Default', value: 'var(--color-border-default)', hex: '#262626' },
    { name: 'Border Accent', value: 'var(--color-border-accent)', hex: '#ea580c' },
    { name: 'Text Primary', value: 'var(--color-text-primary)', hex: '#fafafa' },
    { name: 'Text Secondary', value: 'var(--color-text-secondary)', hex: '#737373' },
  ];

  const chartColors = [
    { name: 'Orange', value: 'var(--color-chart-1)', code: '0.65 0.26 30' },
    { name: 'Cyan', value: 'var(--color-chart-2)', code: '0.75 0.18 190' },
    { name: 'Yellow', value: 'var(--color-chart-3)', code: '0.88 0.21 95' },
    { name: 'Violet', value: 'var(--color-chart-4)', code: '0.58 0.32 285' },
    { name: 'Green', value: 'var(--color-chart-5)', code: '0.72 0.2 150' },
    { name: 'Pink', value: 'var(--color-chart-6)', code: '0.68 0.24 0' },
    { name: 'Blue', value: 'var(--color-chart-7)', code: '0.58 0.28 250' },
    { name: 'Amber', value: 'var(--color-chart-8)', code: '0.7 0.22 50' },
  ];

  return (
    <section>
      <SectionHeader id="colors" title="Colors" description="Orange-accented dark theme palette" />

      <div className="flex flex-col gap-8">
        {/* Theme Colors */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Theme</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {colors.map((color) => (
              <div key={color.name} className="flex flex-col gap-2">
                <div
                  className="h-16 border border-[var(--color-border-default)]"
                  style={{ backgroundColor: color.value }}
                />
                <span className="text-display text-sm text-[var(--color-text-primary)]">{color.name}</span>
                <span className="text-mono text-xs text-[var(--color-text-secondary)]">{color.hex}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart Colors */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Chart Palette (OKLCH)</h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
            {chartColors.map((color) => (
              <div key={color.name} className="flex flex-col gap-2">
                <div
                  className="h-16 border border-[var(--color-border-default)]"
                  style={{ backgroundColor: color.value }}
                />
                <span className="text-display text-xs text-[var(--color-text-primary)]">{color.name}</span>
                <span className="text-mono text-xs text-[var(--color-text-secondary)] break-all">{color.code}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TypographySection() {
  return (
    <section>
      <SectionHeader id="typography" title="Typography" description="Chakra Petch for UI, IBM Plex Mono for code" />

      <div className="flex flex-col gap-8">
        {/* Display Font */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Display Font (Chakra Petch)</h3>
          <div className="flex flex-col gap-2">
            <p className="text-display text-3xl">The quick brown fox jumps over the lazy dog</p>
            <p className="text-brutal text-xl">BRUTALIST UPPERCASE HEADING</p>
            <p className="text-display text-base">Regular body text for descriptions and content.</p>
          </div>
        </div>

        {/* Mono Font */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Mono Font (IBM Plex Mono)</h3>
          <div className="flex flex-col gap-2">
            <code className="text-mono text-sm text-[var(--color-primary)]">const code = "For technical content";</code>
            <span className="text-code text-[var(--color-text-secondary)]">2024-01-15 • Technical metadata</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ButtonSection() {
  return (
    <section>
      <SectionHeader id="buttons" title="Buttons" description="Primary actions with saturation hover effects" />

      <div className="flex flex-col gap-8">
        {/* Variants */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Variants</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </div>

        {/* Sizes */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Sizes</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">Extra Large</Button>
          </div>
        </div>

        {/* States */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">States</h3>
          <div className="flex flex-wrap gap-3">
            <Button disabled>Disabled</Button>
          </div>
        </div>

        {/* With Icon */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">With Icons</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">
              <PlusIcon />
              New Project
            </Button>
            <Button variant="secondary">
              Save
              <CheckIcon />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function BadgeSection() {
  return (
    <section>
      <SectionHeader id="badges" title="Badges" description="Status indicators and tags" />

      <div className="flex flex-col gap-8">
        {/* Variants */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Variants</h3>
          <div className="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge variant="primary">Featured</Badge>
            <Badge variant="danger">Live</Badge>
            <Badge variant="warning">Beta</Badge>
            <Badge variant="info">New</Badge>
            <Badge variant="outline">Tag</Badge>
            <Badge variant="ghost">Draft</Badge>
          </div>
        </div>

        {/* Sizes */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Sizes</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Badge size="sm">Small</Badge>
            <Badge size="md">Medium</Badge>
            <Badge size="lg">Large</Badge>
          </div>
        </div>
      </div>
    </section>
  );
}

function CardSection() {
  return (
    <section>
      <SectionHeader id="cards" title="Cards" description="Content containers with optional interactivity" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Basic Card */}
        <Card>
          <CardContent>
            <CardTitle>Basic Card</CardTitle>
            <CardMeta>Simple card with title and description</CardMeta>
          </CardContent>
        </Card>

        {/* Interactive Card */}
        <Card interactive>
          <div
            className="relative w-full bg-[var(--color-surface-elevated)] flex items-center justify-center"
            style={{ aspectRatio: '16/9' }}
          >
            <span className="text-brutal text-[var(--color-text-tertiary)]">THUMBNAIL</span>
          </div>
          <CardContent>
            <CardTitle>Interactive Card</CardTitle>
            <CardMeta>Hover for accent title</CardMeta>
          </CardContent>
        </Card>

        {/* Card with Footer */}
        <Card interactive borderWidth="thick">
          <div
            className="relative w-full bg-[var(--color-surface-elevated)] flex items-center justify-center"
            style={{ aspectRatio: '16/9' }}
          >
            <span className="text-brutal text-[var(--color-text-tertiary)]">THUMBNAIL</span>
          </div>
          <CardContent>
            <CardTitle>Card with Footer</CardTitle>
            <CardMeta>Includes badges in footer</CardMeta>
          </CardContent>
          <CardFooter>
            <Badge variant="primary" size="sm">Featured</Badge>
            <Badge variant="info" size="sm">New</Badge>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}

function LinkSection() {
  return (
    <section>
      <SectionHeader id="links" title="Links" description="Navigation and action links" />

      <div className="flex flex-col gap-8">
        {/* Variants */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Variants</h3>
          <div className="flex flex-wrap gap-4">
            <Link href="#">Default Link</Link>
            <Link variant="primary" href="#">Primary Link</Link>
            <Link variant="ghost" href="#">Ghost Link</Link>
            <Link variant="danger" href="#">Danger Link</Link>
          </div>
        </div>

        {/* External */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">External Links</h3>
          <div className="flex flex-wrap gap-4">
            <Link href="https://example.com" external>External Site</Link>
            <Link variant="primary" href="https://example.com" external>Documentation</Link>
          </div>
        </div>

        {/* Underline Styles */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Underline Styles</h3>
          <div className="flex flex-wrap gap-4">
            <Link underline="none" href="#">No Underline</Link>
            <Link underline="hover" href="#">Hover Underline</Link>
            <Link underline="always" href="#">Always Underline</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function TooltipSection() {
  return (
    <section>
      <SectionHeader id="tooltips" title="Tooltips" description="Informational overlays using CSS anchor positioning" />

      <div className="flex flex-col gap-8">
        {/* Positions */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Positions</h3>
          <div className="flex flex-wrap gap-8 items-center py-8">
            <Tooltip content="Tooltip on top" position="top">
              <Button variant="secondary">Top</Button>
            </Tooltip>
            <Tooltip content="Tooltip on bottom" position="bottom">
              <Button variant="secondary">Bottom</Button>
            </Tooltip>
            <Tooltip content="Tooltip on left" position="left">
              <Button variant="secondary">Left</Button>
            </Tooltip>
            <Tooltip content="Tooltip on right" position="right">
              <Button variant="secondary">Right</Button>
            </Tooltip>
          </div>
        </div>

        {/* Rich Content */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Rich Content</h3>
          <div className="flex flex-wrap gap-4 py-4">
            <Tooltip
              content={
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">Keyboard Shortcut</span>
                  <span className="text-code text-xs">Ctrl + S</span>
                </div>
              }
            >
              <Button variant="primary">Save</Button>
            </Tooltip>
            <Tooltip content="Delete this item permanently" position="bottom">
              <Button variant="danger">Delete</Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </section>
  );
}

function FormInputsSection() {
  const [radioValue, setRadioValue] = useState('option1');

  return (
    <section>
      <SectionHeader id="form-inputs" title="Form Inputs" description="Text inputs, selects, checkboxes, and radios with hairline borders" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Text Inputs */}
        <div className="flex flex-col gap-6">
          <h3 className="text-display text-sm text-[var(--color-text-secondary)]">Text Inputs</h3>

          <Input placeholder="Enter text..." />

          <Input label="Email Address" type="email" placeholder="you@example.com" />

          <Input
            label="With Helper"
            placeholder="Username"
            helperText="Choose a unique username"
          />

          <Input
            label="With Error"
            placeholder="Enter value"
            error="This field is required"
          />

          <Input
            label="Disabled"
            placeholder="Cannot edit"
            disabled
          />
        </div>

        {/* Textarea */}
        <div className="flex flex-col gap-6">
          <h3 className="text-display text-sm text-[var(--color-text-secondary)]">Textarea</h3>

          <Textarea placeholder="Enter description..." rows={3} />

          <Textarea
            label="Message"
            placeholder="Write your message here..."
            rows={4}
          />

          <Textarea
            label="With Error"
            error="Message is too short"
            rows={3}
          />
        </div>

        {/* Select */}
        <div className="flex flex-col gap-6">
          <h3 className="text-display text-sm text-[var(--color-text-secondary)]">Select</h3>

          <Select>
            <option value="">Choose an option...</option>
            <option value="art">Art</option>
            <option value="tech">Technology</option>
            <option value="design">Design</option>
          </Select>

          <Select label="Category">
            <option value="">Select category</option>
            <option value="generative">Generative</option>
            <option value="interactive">Interactive</option>
            <option value="shader">Shader</option>
          </Select>

          <Select label="With Error" error="Please select an option">
            <option value="">Choose...</option>
          </Select>
        </div>

        {/* Checkbox & Radio */}
        <div className="flex flex-col gap-6">
          <h3 className="text-display text-sm text-[var(--color-text-secondary)]">Checkbox & Radio</h3>

          <div className="flex flex-col gap-3">
            <Checkbox label="Accept terms and conditions" />
            <Checkbox label="Subscribe to newsletter" defaultChecked />
            <Checkbox label="Disabled option" disabled />
          </div>

          <div className="flex flex-col gap-3">
            <Radio
              name="options"
              value="option1"
              label="Option One"
              checked={radioValue === 'option1'}
              onChange={() => setRadioValue('option1')}
            />
            <Radio
              name="options"
              value="option2"
              label="Option Two"
              checked={radioValue === 'option2'}
              onChange={() => setRadioValue('option2')}
            />
            <Radio
              name="options"
              value="option3"
              label="Option Three"
              checked={radioValue === 'option3'}
              onChange={() => setRadioValue('option3')}
            />
          </div>
        </div>

        {/* Sizes */}
        <div className="flex flex-col gap-6">
          <h3 className="text-display text-sm text-[var(--color-text-secondary)]">Input Sizes</h3>

          <Input size="sm" placeholder="Small input" />
          <Input size="md" placeholder="Medium input (default)" />
          <Input size="lg" placeholder="Large input" />
        </div>

        {/* Date & Time */}
        <div className="flex flex-col gap-6">
          <h3 className="text-display text-sm text-[var(--color-text-secondary)]">Date & Time</h3>

          <DateInput type="date" label="Date" />
          <DateInput type="time" label="Time" />
          <DateInput type="datetime-local" label="Date & Time" />
        </div>

        {/* Slider & Color */}
        <div className="flex flex-col gap-6">
          <h3 className="text-display text-sm text-[var(--color-text-secondary)]">Slider & Color</h3>

          <Slider label="Volume" min={0} max={100} defaultValue={50} />
          <Slider label="Opacity" min={0} max={100} defaultValue={75} />
          <ColorInput label="Accent Color" defaultValue="#ea580c" />
        </div>
      </div>
    </section>
  );
}

function ToggleGroupSection() {
  const [single, setSingle] = useState('grid');
  const [multi, setMulti] = useState<string[]>(['featured']);

  const handleSingleChange = (v: string | string[]) => setSingle(v as string);
  const handleMultiChange = (v: string | string[]) => setMulti(v as string[]);

  return (
    <section>
      <SectionHeader id="toggle-groups" title="Toggle Groups" description="Single or multi-select option buttons" />

      <div className="flex flex-col gap-8">
        {/* Single Select */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Single Select</h3>
          <ToggleGroup type="single" value={single} onValueChange={handleSingleChange}>
            <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
            <ToggleGroup.Item value="list">List</ToggleGroup.Item>
            <ToggleGroup.Item value="masonry">Masonry</ToggleGroup.Item>
          </ToggleGroup>
          <p className="text-code text-[var(--color-text-secondary)] mt-2">Selected: {single}</p>
        </div>

        {/* Multiple Select */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Multiple Select</h3>
          <ToggleGroup type="multiple" value={multi} onValueChange={handleMultiChange}>
            <ToggleGroup.Item value="featured">Featured</ToggleGroup.Item>
            <ToggleGroup.Item value="recent">Recent</ToggleGroup.Item>
            <ToggleGroup.Item value="archived">Archived</ToggleGroup.Item>
          </ToggleGroup>
          <p className="text-code text-[var(--color-text-secondary)] mt-2">Selected: {multi.join(', ') || 'none'}</p>
        </div>

        {/* Primary Variant */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Primary Variant</h3>
          <ToggleGroup type="single" value={single} onValueChange={handleSingleChange} variant="primary">
            <ToggleGroup.Item value="all">All</ToggleGroup.Item>
            <ToggleGroup.Item value="photos">Photos</ToggleGroup.Item>
            <ToggleGroup.Item value="videos">Videos</ToggleGroup.Item>
          </ToggleGroup>
        </div>

        {/* Sizes */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Sizes</h3>
          <div className="flex flex-col gap-3">
            <ToggleGroup type="single" value="a" onValueChange={() => {}} size="sm">
              <ToggleGroup.Item value="a">Small</ToggleGroup.Item>
              <ToggleGroup.Item value="b">Size</ToggleGroup.Item>
            </ToggleGroup>
            <ToggleGroup type="single" value="a" onValueChange={() => {}} size="md">
              <ToggleGroup.Item value="a">Medium</ToggleGroup.Item>
              <ToggleGroup.Item value="b">Size</ToggleGroup.Item>
            </ToggleGroup>
            <ToggleGroup type="single" value="a" onValueChange={() => {}} size="lg">
              <ToggleGroup.Item value="a">Large</ToggleGroup.Item>
              <ToggleGroup.Item value="b">Size</ToggleGroup.Item>
            </ToggleGroup>
          </div>
        </div>
      </div>
    </section>
  );
}

function ButtonGroupSection() {
  return (
    <section>
      <SectionHeader id="button-groups" title="Button Groups" description="Grouped actions" />

      <div className="flex flex-col gap-8">
        {/* Action Group */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Action Group</h3>
          <ButtonGroup>
            <Button variant="secondary">Edit</Button>
            <Button variant="secondary">Duplicate</Button>
            <Button variant="danger">Delete</Button>
          </ButtonGroup>
        </div>

        {/* Detached */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Detached Group</h3>
          <ButtonGroup attached={false}>
            <Button variant="primary">Save</Button>
            <Button variant="secondary">Cancel</Button>
          </ButtonGroup>
        </div>
      </div>
    </section>
  );
}

function DiagonalDividerSection() {
  return (
    <section>
      <SectionHeader id="dividers" title="Diagonal Dividers" description="Brutalist slash separators" />

      <div className="flex flex-col gap-8">
        {/* Inline Example */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Inline Usage</h3>
          <div className="flex items-center gap-4 h-10">
            <span className="text-display">Item One</span>
            <DiagonalDivider height="2.5rem" />
            <span className="text-display">Item Two</span>
            <DiagonalDivider height="2.5rem" tone="accent" />
            <span className="text-display">Item Three</span>
          </div>
        </div>

        {/* Variants */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Thickness Variants</h3>
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <DiagonalDivider height="3rem" variant="default" />
              <span className="text-code text-xs">Default</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <DiagonalDivider height="3rem" variant="thick" />
              <span className="text-code text-xs">Thick</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <DiagonalDivider height="3rem" variant="heavy" />
              <span className="text-code text-xs">Heavy</span>
            </div>
          </div>
        </div>

        {/* Colors */}
        <div>
          <h3 className="text-display text-sm text-[var(--color-text-secondary)] mb-3">Color Variants</h3>
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <DiagonalDivider height="3rem" tone="default" />
              <span className="text-code text-xs">Default</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <DiagonalDivider height="3rem" tone="strong" />
              <span className="text-code text-xs">Strong</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <DiagonalDivider height="3rem" tone="accent" />
              <span className="text-code text-xs">Accent</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Icon Components
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="square" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="square" d="M5 13l4 4L19 7" />
    </svg>
  );
}

