/**
 * Card - Container component for speed-dial items
 *
 * Brutalist card design with optional thumbnail, title, and metadata.
 * Supports hover states with glow effect.
 *
 * @example
 * <Card>
 *   <Card.Content>Basic card</Card.Content>
 * </Card>
 *
 * <Card interactive>
 *   <Card.Thumbnail src="/image.jpg" alt="Art piece" />
 *   <Card.Content>
 *     <Card.Title>Project Name</Card.Title>
 *     <Card.Meta>2024 • Digital Art</Card.Meta>
 *   </Card.Content>
 * </Card>
 */

import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  forwardRef,
} from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

// Outer wrapper creates the notched border frame
const cardFrameVariants = cva(
  [
    'bg-[var(--color-border-default)]', // Border color as background
    'p-px', // 1px "border" thickness
    'transition-brutal',
  ].join(' '),
  {
    variants: {
      interactive: {
        true: [
          'group',
          'cursor-pointer',
          'press-effect',
          'hover:bg-[var(--color-border-accent)]',
        ].join(' '),
        false: '',
      },
      notch: {
        none: '',
        sm: 'notch-sm',
        md: 'notch-md',
        lg: 'notch-lg',
      },
    },
    defaultVariants: {
      interactive: false,
      notch: 'md',
    },
  }
);

// Inner content area
const cardVariants = cva(
  [
    'surface-card',
    'overflow-hidden',
    'flex flex-col',
    'w-full h-full',
  ].join(' '),
  {
    variants: {
      notch: {
        none: '',
        sm: 'notch-sm',
        md: 'notch-md',
        lg: 'notch-lg',
      },
    },
    defaultVariants: {
      notch: 'md',
    },
  }
);

export interface CardProps
  extends ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof cardVariants> {
  /**
   * If true, card will have hover effects and cursor pointer
   */
  interactive?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive, notch, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cardFrameVariants({
          interactive,
          notch,
          className,
        })}
        {...props}
      >
        <div className={cardVariants({ notch })}>
          {children}
        </div>
      </div>
    );
  }
);
Card.displayName = 'Card';

// Thumbnail Component
export interface CardThumbnailProps extends ComponentPropsWithoutRef<'div'> {
  src: string;
  alt: string;
  aspectRatio?: '1/1' | '16/9' | '4/3' | '3/2';
}

function CardThumbnail({
  src,
  alt,
  aspectRatio = '16/9',
  className,
  ...props
}: CardThumbnailProps) {
  return (
    <div
      className={`relative w-full bg-[var(--color-surface-elevated)] overflow-hidden ${className || ''}`}
      style={{ aspectRatio }}
      {...props}
    >
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

// Content Container
export interface CardContentProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
}

function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div
      className={`p-4 flex flex-col gap-2 flex-1 ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Title Component
export interface CardTitleProps extends ComponentPropsWithoutRef<'h3'> {
  children: ReactNode;
}

function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h3
      className={`text-display font-semibold uppercase tracking-[var(--tracking-wide)] text-base text-[var(--color-text-primary)] leading-tight m-0 transition-colors group-hover:text-[var(--color-primary)] ${className || ''}`}
      {...props}
    >
      {children}
    </h3>
  );
}

// Meta/Description Component
export interface CardMetaProps extends ComponentPropsWithoutRef<'p'> {
  children: ReactNode;
}

function CardMeta({ className, children, ...props }: CardMetaProps) {
  return (
    <p
      className={`text-display text-xs text-[var(--color-text-secondary)] tracking-[var(--tracking-wide)] m-0 ${className || ''}`}
      {...props}
    >
      {children}
    </p>
  );
}

// Footer Component (for badges, actions, etc)
export interface CardFooterProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
}

function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={`px-4 pb-4 pt-0 flex items-center gap-2 ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Compound component type
type CardComponent = typeof Card & {
  Thumbnail: typeof CardThumbnail;
  Content: typeof CardContent;
  Title: typeof CardTitle;
  Meta: typeof CardMeta;
  Footer: typeof CardFooter;
};

// Attach subcomponents
(Card as CardComponent).Thumbnail = CardThumbnail;
(Card as CardComponent).Content = CardContent;
(Card as CardComponent).Title = CardTitle;
(Card as CardComponent).Meta = CardMeta;
(Card as CardComponent).Footer = CardFooter;

// Export compound component
const CardWithSubs = Card as CardComponent;
export { CardWithSubs as Card, CardThumbnail, CardContent, CardTitle, CardMeta, CardFooter };

// Export variants
export { cardVariants, cardFrameVariants };
