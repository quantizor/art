/**
 * Textarea - Brutalist multi-line text input
 *
 * @example
 * <Textarea placeholder="Enter description..." />
 * <Textarea label="Message" rows={5} />
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const textareaVariants = cva(
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
    'resize-y min-h-[80px]',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'p-2 text-sm',
        md: 'p-3 text-base',
        lg: 'p-4 text-lg',
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

export interface TextareaProps
  extends Omit<ComponentPropsWithoutRef<'textarea'>, 'size'>,
    VariantProps<typeof textareaVariants> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
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
    const inputId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
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
        <textarea
          ref={ref}
          id={inputId}
          className={textareaVariants({ size, hasError, className })}
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
Textarea.displayName = 'Textarea';

export { textareaVariants };
