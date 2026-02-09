/**
 * BRUTALIST CYBERPUNK DESIGN SYSTEM - USAGE EXAMPLES
 *
 * This file demonstrates all components and common patterns.
 * Copy these examples into your application as needed.
 */

import { useState } from 'react';
import {
  Button,
  Badge,
  Card,
  Link,
  ToggleGroup,
  ButtonGroup,
} from './index';

// ============================================
// BUTTON EXAMPLES
// ============================================

export function ButtonExamples() {
  return (
    <div className="flex flex-col gap-6 p-8 surface-base">
      <section>
        <h2 className="text-brutal text-xl mb-4">Button Variants</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary Action</Button>
          <Button variant="secondary">Secondary Action</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="danger">Delete</Button>
        </div>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">Button Sizes</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="xl">Extra Large</Button>
        </div>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">Button States</h2>
        <div className="flex flex-wrap gap-3">
          <Button disabled>Disabled</Button>
          <Button fullWidth>Full Width Button</Button>
        </div>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">With Icons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="square" d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Button>
          <Button variant="secondary">
            Save
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="square" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Button>
        </div>
      </section>
    </div>
  );
}

// ============================================
// BADGE EXAMPLES
// ============================================

export function BadgeExamples() {
  return (
    <div className="flex flex-col gap-6 p-8 surface-base">
      <section>
        <h2 className="text-brutal text-xl mb-4">Badge Variants</h2>
        <div className="flex flex-wrap gap-3">
          <Badge>Default</Badge>
          <Badge variant="primary">Featured</Badge>
          <Badge variant="danger">Live</Badge>
          <Badge variant="warning">Beta</Badge>
          <Badge variant="info">New</Badge>
          <Badge variant="outline">Tag</Badge>
          <Badge variant="ghost">Draft</Badge>
        </div>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">Badge Sizes</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Badge size="sm">Small</Badge>
          <Badge size="md">Medium</Badge>
          <Badge size="lg">Large</Badge>
        </div>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">Badge Styles</h2>
        <div className="flex flex-wrap gap-3">
          <Badge borderWidth="none">No Border</Badge>
          <Badge borderWidth="thin">Thin Border</Badge>
          <Badge borderWidth="default">Default Border</Badge>
        </div>
      </section>
    </div>
  );
}

// ============================================
// CARD EXAMPLES
// ============================================

export function CardExamples() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8 surface-base">
      {/* Basic Card */}
      <Card>
        <Card.Content>
          <Card.Title>Basic Card</Card.Title>
          <Card.Meta>Simple card with title and meta</Card.Meta>
        </Card.Content>
      </Card>

      {/* Interactive Card with Thumbnail */}
      <Card interactive onClick={() => console.log('Card clicked')}>
        <Card.Thumbnail
          src="/api/placeholder/400/300"
          alt="Art piece"
          aspectRatio="16/9"
        />
        <Card.Content>
          <Card.Title>Interactive Project</Card.Title>
          <Card.Meta>2024 • Digital Art • Featured</Card.Meta>
        </Card.Content>
      </Card>

      {/* Card with Footer */}
      <Card interactive>
        <Card.Thumbnail
          src="/api/placeholder/400/400"
          alt="Art piece"
          aspectRatio="1/1"
        />
        <Card.Content>
          <Card.Title>Cyberpunk 2077</Card.Title>
          <Card.Meta>Night City • Photography</Card.Meta>
        </Card.Content>
        <Card.Footer>
          <Badge variant="primary" size="sm">Featured</Badge>
          <Badge variant="info" size="sm">New</Badge>
        </Card.Footer>
      </Card>

      {/* Speed Dial Card Example */}
      <Card
        interactive
        onClick={() => window.location.href = '/project/1'}
      >
        <Card.Thumbnail
          src="/api/placeholder/400/300"
          alt="Speed dial item"
          aspectRatio="16/9"
        />
        <Card.Content>
          <div className="flex items-start justify-between">
            <div>
              <Card.Title>Portfolio Site</Card.Title>
              <Card.Meta>portfolio.dev</Card.Meta>
            </div>
            <Badge variant="primary" size="sm">P1</Badge>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

// ============================================
// TOGGLE GROUP EXAMPLES
// ============================================

export function ToggleGroupExamples() {
  const [view, setView] = useState('grid');
  const [filters, setFilters] = useState<string[]>(['featured']);

  const handleViewChange = (v: string | string[]) => setView(v as string);
  const handleFiltersChange = (v: string | string[]) => setFilters(v as string[]);

  return (
    <div className="flex flex-col gap-8 p-8 surface-base">
      <section>
        <h2 className="text-brutal text-xl mb-4">Single Select (Radio)</h2>
        <ToggleGroup type="single" value={view} onValueChange={handleViewChange}>
          <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
          <ToggleGroup.Item value="list">List</ToggleGroup.Item>
          <ToggleGroup.Item value="masonry">Masonry</ToggleGroup.Item>
        </ToggleGroup>
        <p className="text-mono text-sm text-[var(--color-text-secondary)] mt-2">
          Selected: {view}
        </p>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">Multiple Select (Checkbox)</h2>
        <ToggleGroup
          type="multiple"
          value={filters}
          onValueChange={handleFiltersChange}
        >
          <ToggleGroup.Item value="featured">Featured</ToggleGroup.Item>
          <ToggleGroup.Item value="recent">Recent</ToggleGroup.Item>
          <ToggleGroup.Item value="archived">Archived</ToggleGroup.Item>
        </ToggleGroup>
        <p className="text-mono text-sm text-[var(--color-text-secondary)] mt-2">
          Selected: {filters.join(', ') || 'none'}
        </p>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">Primary Variant</h2>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={handleViewChange}
          variant="primary"
        >
          <ToggleGroup.Item value="all">All</ToggleGroup.Item>
          <ToggleGroup.Item value="photos">Photos</ToggleGroup.Item>
          <ToggleGroup.Item value="videos">Videos</ToggleGroup.Item>
        </ToggleGroup>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">Sizes</h2>
        <div className="flex flex-col gap-3">
          <ToggleGroup type="single" value={view} onValueChange={handleViewChange} size="sm">
            <ToggleGroup.Item value="sm1">Small</ToggleGroup.Item>
              <ToggleGroup.Item value="sm2">Size</ToggleGroup.Item>
          </ToggleGroup>

          <ToggleGroup type="single" value={view} onValueChange={handleViewChange} size="md">
            <ToggleGroup.Item value="md1">Medium</ToggleGroup.Item>
              <ToggleGroup.Item value="md2">Size</ToggleGroup.Item>
          </ToggleGroup>

          <ToggleGroup type="single" value={view} onValueChange={handleViewChange} size="lg">
            <ToggleGroup.Item value="lg1">Large</ToggleGroup.Item>
              <ToggleGroup.Item value="lg2">Size</ToggleGroup.Item>
          </ToggleGroup>
        </div>
      </section>
    </div>
  );
}

// ============================================
// BUTTON GROUP EXAMPLES
// ============================================

export function ButtonGroupExamples() {
  return (
    <div className="flex flex-col gap-8 p-8 surface-base">
      <section>
        <h2 className="text-brutal text-xl mb-4">Action Groups</h2>
        <ButtonGroup>
          <Button variant="secondary">Edit</Button>
          <Button variant="secondary">Duplicate</Button>
          <Button variant="danger">Delete</Button>
        </ButtonGroup>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">Toolbar</h2>
        <ButtonGroup size="sm">
          <Button variant="secondary" size="sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="square" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Button>
          <Button variant="secondary" size="sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="square" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
          <Button variant="secondary" size="sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="square" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </Button>
        </ButtonGroup>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">Detached Group</h2>
        <ButtonGroup attached={false}>
          <Button variant="primary">Save</Button>
          <Button variant="secondary">Cancel</Button>
        </ButtonGroup>
      </section>
    </div>
  );
}

// ============================================
// LINK EXAMPLES
// ============================================

export function LinkExamples() {
  return (
    <div className="flex flex-col gap-6 p-8 surface-base">
      <section>
        <h2 className="text-brutal text-xl mb-4">Link Variants</h2>
        <div className="flex flex-wrap gap-4">
          <Link href="#">Default Link</Link>
          <Link variant="primary" href="#">Primary Link</Link>
          <Link variant="ghost" href="#">Ghost Link</Link>
          <Link variant="danger" href="#">Danger Link</Link>
        </div>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">External Links</h2>
        <div className="flex flex-wrap gap-4">
          <Link href="https://example.com" external>
            External Site
          </Link>
          <Link variant="primary" href="https://example.com" external>
            Documentation
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-brutal text-xl mb-4">Underline Styles</h2>
        <div className="flex flex-wrap gap-4">
          <Link underline="none" href="#">No Underline</Link>
          <Link underline="hover" href="#">Hover Underline</Link>
          <Link underline="always" href="#">Always Underline</Link>
        </div>
      </section>
    </div>
  );
}

// ============================================
// SPEED DIAL INTERFACE EXAMPLE
// ============================================

export function SpeedDialExample() {
  const [view, setView] = useState('grid');
  const [filter, setFilter] = useState<string[]>(['all']);

  const projects = [
    {
      id: 1,
      title: 'Portfolio Site',
      url: 'portfolio.dev',
      image: '/api/placeholder/400/300',
      tags: ['Featured', 'Active'],
      shortcut: 'P1',
    },
    {
      id: 2,
      title: 'E-Commerce App',
      url: 'shop.app',
      image: '/api/placeholder/400/300',
      tags: ['Active'],
      shortcut: 'P2',
    },
    {
      id: 3,
      title: 'Blog Platform',
      url: 'blog.io',
      image: '/api/placeholder/400/300',
      tags: ['Archived'],
      shortcut: 'P3',
    },
  ];

  return (
    <div className="min-h-screen surface-base p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-brutal text-3xl text-[var(--color-primary)]">
            SPEED DIAL
          </h1>
          <ButtonGroup>
            <Button variant="secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="square" d="M12 4v16m8-8H4" />
              </svg>
              New
            </Button>
              <Button variant="secondary">Settings</Button>
          </ButtonGroup>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <ToggleGroup
            type="multiple"
            value={filter}
            onValueChange={(v) => setFilter(v as string[])}
            variant="primary"
          >
            <ToggleGroup.Item value="all">All</ToggleGroup.Item>
              <ToggleGroup.Item value="featured">Featured</ToggleGroup.Item>
              <ToggleGroup.Item value="active">Active</ToggleGroup.Item>
          </ToggleGroup>

          <ToggleGroup type="single" value={view} onValueChange={(v) => setView(v as string)} size="sm">
            <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
              <ToggleGroup.Item value="list">List</ToggleGroup.Item>
          </ToggleGroup>
        </div>
      </header>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map((project) => (
          <Card
            key={project.id}
            interactive
            onClick={() => window.location.href = `/${project.url}`}
          >
            <Card.Thumbnail
              src={project.image}
              alt={project.title}
              aspectRatio="16/9"
            />
            <Card.Content>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <Card.Title>{project.title}</Card.Title>
                  <Card.Meta>{project.url}</Card.Meta>
                </div>
                <Badge variant="primary" size="sm">
                  {project.shortcut}
                </Badge>
              </div>
            </Card.Content>
            <Card.Footer>
              {project.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant={tag === 'Featured' ? 'primary' : 'outline'}
                  size="sm"
                >
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
