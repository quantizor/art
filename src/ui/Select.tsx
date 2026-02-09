/**
 * Select - Brutalist dropdown select component
 *
 * Uses modern CSS customizable select (appearance: base-select) for fully
 * styled dropdowns in supporting browsers (Chrome 135+). Falls back to
 * styled trigger with native dropdown in older browsers.
 *
 * @example
 * <Select label="Category">
 *   <option value="">Choose...</option>
 *   <option value="art">Art</option>
 *   <option value="tech">Tech</option>
 * </Select>
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const selectVariants = cva(
  [
    'w-full',
    'styled-select', // Enables appearance: base-select in theme.css
    'text-display text-[var(--color-text-primary)]',
    'bg-black',
    'border-solid border-[1px] border-[var(--color-border-default)]',
    'transition-brutal',
    'hover:border-[var(--color-border-accent)]',
    'focus:outline-none focus:border-[var(--color-border-accent)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border-default)]',
    'cursor-pointer',
    'flex items-center font-semibold',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-sm leading-none',
        md: 'h-10 px-4 text-base leading-none',
        lg: 'h-12 px-5 text-lg leading-none',
      },
      hasError: {
        true: 'border-[var(--color-danger)] hover:border-[var(--color-danger)] focus:border-[var(--color-danger)]',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
      hasError: false,
    },
  }
);

export interface SelectProps
  extends Omit<ComponentPropsWithoutRef<'select'>, 'size'>,
    VariantProps<typeof selectVariants> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      size,
      label,
      error,
      helperText,
      className,
      id,
      children,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-display text-sm font-medium uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={selectVariants({ size, hasError, className })}
          aria-invalid={hasError}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-display text-xs text-[var(--color-danger)]"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-display text-xs text-[var(--color-text-tertiary)]"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

export { selectVariants };
