/**
 * Link - Styled navigation link component
 *
 * Brutalist link styling for navigation and actions.
 * Supports multiple variants and states.
 *
 * @example
 * <Link href="/portfolio">View Portfolio</Link>
 * <Link variant="primary" href="/contact">Contact</Link>
 * <Link variant="ghost" href="/about">About</Link>
 */

import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const linkVariants = cva(
  [
    'inline-flex items-center gap-1',
    'text-display',
    'font-semibold uppercase tracking-[var(--tracking-wider)]',
    'transition-brutal',
    'cursor-pointer select-none',
    'focus-visible:outline-none focus-visible:underline',
    'focus-visible:underline-offset-4',
    'focus-visible:decoration-[var(--color-primary)]',
    'focus-visible:decoration-2',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'text-[var(--color-text-primary)]',
          'hover:text-[var(--color-primary)]',
          'active:text-[var(--color-primary-active)]',
        ].join(' '),
        primary: [
          'text-[var(--color-primary)]',
          'hover:text-[var(--color-primary-hover)]',
          'active:text-[var(--color-primary-active)]',
          'hover:drop-shadow-[0_0_8px_var(--color-primary-glow)]',
        ].join(' '),
        ghost: [
          'text-[var(--color-text-secondary)]',
          'hover:text-[var(--color-text-primary)]',
          'active:text-[var(--color-primary)]',
        ].join(' '),
        danger: [
          'text-[var(--color-danger)]',
          'hover:text-[var(--color-red-400)]',
          'active:text-[var(--color-red-600)]',
        ].join(' '),
      },
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      },
      underline: {
        none: 'no-underline',
        hover: 'no-underline hover:underline hover:underline-offset-4',
        always: 'underline underline-offset-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      underline: 'hover',
    },
  }
);

export interface LinkProps
  extends ComponentPropsWithoutRef<'a'>,
    VariantProps<typeof linkVariants> {
  /**
   * External link (opens in new tab)
   */
  external?: boolean;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      variant,
      size,
      underline,
      external,
      className,
      children,
      href,
      ...props
    },
    ref
  ) => {
    const externalProps = external
      ? {
          target: '_blank',
          rel: 'noopener noreferrer',
        }
      : {};

    return (
      <a
        ref={ref}
        href={href}
        className={linkVariants({
          variant,
          size,
          underline,
          className,
        })}
        {...externalProps}
        {...props}
      >
        {children}
        {external && (
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              strokeLinecap="square"
              strokeLinejoin="miter"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        )}
      </a>
    );
  }
);
Link.displayName = 'Link';

// Export variants
export { linkVariants };
