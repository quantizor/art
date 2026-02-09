/**
 * Badge - Status indicator component
 *
 * Small label for tags, status indicators, and metadata.
 * Features harsh rectangular design with optional borders.
 *
 * @example
 * <Badge>Default</Badge>
 * <Badge variant="primary">Featured</Badge>
 * <Badge variant="warning">Beta</Badge>
 * <Badge variant="outline">Tag</Badge>
 */

import { type ComponentPropsWithoutRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  [
    'inline-flex items-center justify-center',
    'text-display',
    'font-semibold uppercase',
    'border-solid border',
    'whitespace-nowrap',
    'select-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'bg-[var(--color-surface-elevated)]',
          'text-[var(--color-text-secondary)]',
          'border-[var(--color-border-default)]',
        ].join(' '),
        primary: [
          'bg-[var(--color-primary)]',
          'text-[var(--color-text-inverse)]',
          'border-[var(--color-primary)]',
        ].join(' '),
        danger: [
          'bg-[var(--color-danger)]',
          'text-[var(--color-text-inverse)]',
          'border-[var(--color-danger)]',
        ].join(' '),
        warning: [
          'bg-[var(--color-warning)]',
          'text-[var(--color-text-inverse)]',
          'border-[var(--color-warning)]',
        ].join(' '),
        info: [
          'bg-[var(--color-info)]',
          'text-[var(--color-text-inverse)]',
          'border-[var(--color-info)]',
        ].join(' '),
        outline: [
          'bg-transparent',
          'text-[var(--color-text-primary)]',
          'border-[var(--color-border-strong)]',
        ].join(' '),
        ghost: [
          'bg-transparent',
          'text-[var(--color-text-secondary)]',
          'border-transparent',
        ].join(' '),
      },
      size: {
        sm: 'h-4 px-1.5 text-xs tracking-[var(--tracking-wide)]',
        md: 'h-5 px-2 text-xs tracking-[var(--tracking-wider)]',
        lg: 'h-6 px-3 text-sm tracking-[var(--tracking-wider)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends ComponentPropsWithoutRef<'span'>,
    VariantProps<typeof badgeVariants> {}

export function Badge({
  variant,
  size,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={badgeVariants({
        variant,
        size,
        className,
      })}
      {...props}
    >
      {children}
    </span>
  );
}

// Export variants for external use
export { badgeVariants };
