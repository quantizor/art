/**
 * Input - Brutalist text input component
 *
 * Features thick borders, no border-radius, high contrast focus states.
 *
 * @example
 * <Input placeholder="Enter text..." />
 * <Input type="email" label="Email" />
 * <Input error="Invalid input" />
 */

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  [
    'w-full',
    'text-display text-[var(--color-text-primary)]',
    'bg-[var(--color-surface-card)]',
    'border-solid border-[1px] border-[var(--color-border-default)]',
    'placeholder:text-[var(--color-text-tertiary)]',
    'transition-brutal',
    'hover:border-[var(--color-border-accent)]',
    'focus:outline-none focus:border-[var(--color-border-accent)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border-default)]',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-5 text-lg',
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

export interface InputProps
  extends Omit<ComponentPropsWithoutRef<'input'>, 'size'>,
    VariantProps<typeof inputVariants> {
  /**
   * Label displayed above the input
   */
  label?: string;
  /**
   * Error message displayed below the input
   */
  error?: string;
  /**
   * Helper text displayed below the input
   */
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size,
      label,
      error,
      helperText,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
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
        <input
          ref={ref}
          id={inputId}
          className={inputVariants({ size, hasError, className })}
          aria-invalid={hasError}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
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
Input.displayName = 'Input';

export { inputVariants };
