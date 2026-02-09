/**
 * DiagonalDivider - Brutalist diagonal separator component
 *
 * Creates a harsh diagonal "slash" visual separator between elements.
 * Used in compound components like ToggleGroup and ButtonGroup.
 *
 * @example
 * <DiagonalDivider />
 * <DiagonalDivider variant="thick" />
 * <DiagonalDivider className="h-8" />
 */

import { type ComponentPropsWithoutRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const dividerVariants = cva(
  'inline-flex items-center justify-center flex-shrink-0 w-px',
  {
    variants: {
      tone: {
        default: 'text-[var(--color-border-default)]',
        accent: 'text-[var(--color-border-accent)]',
        strong: 'text-[var(--color-border-strong)]',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  }
);

export interface DiagonalDividerProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'children'>,
    VariantProps<typeof dividerVariants> {
  /**
   * Height of the divider container. Defaults to full height of parent.
   * Use className with h-* utilities to control.
   */
  height?: string | number;
  /**
   * @deprecated Use `tone` instead
   */
  color?: 'default' | 'accent' | 'strong';
  /**
   * @deprecated Removed - all dividers are now hairline
   */
  variant?: unknown;
}

export function DiagonalDivider({
  tone,
  color,
  height,
  className,
  style,
  ...props
}: DiagonalDividerProps) {
  const resolvedTone = tone ?? color;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={dividerVariants({ tone: resolvedTone, className })}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...props}
    >
      <svg
        viewBox="0 0 1 100"
        preserveAspectRatio="none"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          x1="0"
          y1="0"
          x2="1"
          y2="100"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

// Export variants for external use
export { dividerVariants };
