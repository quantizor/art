/**
 * Checkbox - Brutalist checkbox component
 *
 * Custom styled checkbox with thick borders and accent fill.
 *
 * @example
 * <Checkbox label="Accept terms" />
 * <Checkbox checked onChange={handleChange} />
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const checkboxVariants = cva(
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
    // Unchecked state - subtle dash indicator
    'relative',
    'after:content-[""]',
    'after:absolute',
    'after:left-1/2 after:top-1/2',
    'after:-translate-x-1/2 after:-translate-y-1/2',
    'after:w-[40%] after:h-[2px]',
    'after:bg-[var(--color-text-tertiary)]',
    'after:transition-all after:duration-100',
    // Checked state
    'checked:bg-[var(--color-primary)]',
    'checked:border-[var(--color-primary)]',
    // Checkmark replaces dash
    'checked:after:-translate-y-[60%]',
    'checked:after:w-[5px] checked:after:h-[10px]',
    'checked:after:bg-transparent',
    'checked:after:border-r-2 checked:after:border-b-2',
    'checked:after:border-[var(--color-text-inverse)]',
    'checked:after:rotate-45',
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

export interface CheckboxProps
  extends Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'size'>,
    VariantProps<typeof checkboxVariants> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ size, label, className, id, ...props }, ref) => {
    const inputId = id || (label ? `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <label className="inline-flex items-center gap-2.5 cursor-pointer group">
        <input
          ref={ref}
          type="checkbox"
          id={inputId}
          className={checkboxVariants({ size, className })}
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
Checkbox.displayName = 'Checkbox';

export { checkboxVariants };
