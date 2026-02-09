/**
 * Button - Brutalist cyberpunk button component
 *
 * Features:
 * - Harsh rectangular design
 * - Saturation-based hover effects
 * - Press effect on active
 * - Multiple variants for different intents
 *
 * @example
 * <Button>Default</Button>
 * <Button variant="primary">Primary Action</Button>
 * <Button variant="ghost" size="sm">Small Ghost</Button>
 * <Button disabled>Disabled</Button>
 */

import { type ComponentPropsWithoutRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  [
    // Base styles
    'inline-flex items-center justify-center',
    'text-brutal',
    'transition-brutal press-effect',
    'cursor-pointer select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-[var(--color-surface-base)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--color-primary)] text-[var(--color-text-inverse)]',
          'hover-saturate',
        ].join(' '),
        secondary: [
          'bg-[var(--color-surface-card)] text-[var(--color-text-primary)]',
          'hover:bg-[var(--color-surface-elevated)]',
          'hover:text-[var(--color-primary)]',
        ].join(' '),
        ghost: [
          'bg-transparent text-[var(--color-text-secondary)]',
          'hover:text-[var(--color-primary)]',
          'hover:bg-[var(--color-surface-card)]',
        ].join(' '),
        danger: [
          'bg-[var(--color-danger)] text-[var(--color-text-inverse)]',
          'hover-saturate',
        ].join(' '),
      },
      size: {
        sm: 'h-8 px-3 text-xs gap-1.5',
        md: 'h-10 px-4 text-sm gap-2',
        lg: 'h-12 px-6 text-base gap-2',
        xl: 'h-14 px-8 text-lg gap-3',
      },
      fullWidth: {
        true: 'w-full',
        false: 'w-auto',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends ComponentPropsWithoutRef<'button'>,
    VariantProps<typeof buttonVariants> {
  /**
   * If true, button will take full width of container
   */
  fullWidth?: boolean;
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonVariants({
        variant,
        size,
        fullWidth,
        className,
      })}
      {...props}
    >
      {children}
    </button>
  );
}

// Export variants for external use
export { buttonVariants };
