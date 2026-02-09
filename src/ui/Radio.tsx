/**
 * Radio - Brutalist radio button component
 *
 * Custom styled radio with thick borders and accent fill.
 * Note: Uses square shape for brutalist aesthetic (no border-radius).
 *
 * @example
 * <Radio name="choice" value="a" label="Option A" />
 * <Radio name="choice" value="b" label="Option B" />
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const radioVariants = cva(
  [
    'appearance-none',
    'flex-shrink-0',
    'bg-black',
    'border-solid border-[var(--color-border-default)]',
    'transition-brutal',
    'cursor-pointer',
    'hover:border-[var(--color-border-accent)]',
    'focus:outline-none focus:border-[var(--color-border-accent)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border-default)]',
    // Unchecked state - subtle square outline indicator
    'relative',
    'after:content-[""]',
    'after:absolute',
    'after:left-1/2 after:top-1/2',
    'after:-translate-x-1/2 after:-translate-y-1/2',
    'after:w-[6px] after:h-[6px]',
    'after:border after:border-[var(--color-text-tertiary)]',
    'after:transition-all after:duration-100',
    // Checked state - square inner fill for brutalist look
    'checked:bg-[var(--color-primary)]',
    'checked:border-[var(--color-primary)]',
    // Inner square indicator replaces outline
    'checked:after:w-2 checked:after:h-2',
    'checked:after:border-0',
    'checked:after:bg-[var(--color-text-inverse)]',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'w-4 h-4 border',
        md: 'w-5 h-5 border',
        lg: 'w-6 h-6 border',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface RadioProps
  extends Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'size'>,
    VariantProps<typeof radioVariants> {
  label?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ size, label, className, id, ...props }, ref) => {
    const inputId = id || (label && props.name ? `radio-${props.name}-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <label className="inline-flex items-center gap-2.5 cursor-pointer group">
        <input
          ref={ref}
          type="radio"
          id={inputId}
          className={radioVariants({ size, className })}
          {...props}
        />
        {label && (
          <span className="text-display text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
            {label}
          </span>
        )}
      </label>
    );
  }
);
Radio.displayName = 'Radio';

export { radioVariants };
