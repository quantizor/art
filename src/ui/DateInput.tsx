/**
 * DateInput - Brutalist date/time input component
 *
 * Custom styled date, time, datetime-local, month, and week inputs.
 * Uses overlay technique to style like a dropdown.
 *
 * @example
 * <DateInput type="date" label="Start Date" />
 * <DateInput type="time" label="Start Time" />
 * <DateInput type="datetime-local" label="Event Time" />
 */

import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const dateInputVariants = cva(
  [
    'w-full',
    'date-input',
    'text-display text-[var(--color-text-primary)] font-semibold',
    'bg-black',
    'border-solid border border-[var(--color-border-default)]',
    'transition-brutal',
    'hover:border-[var(--color-border-accent)]',
    'focus:outline-none focus:border-[var(--color-border-accent)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border-default)]',
    'cursor-pointer',
    'flex items-center',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-5 text-lg',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

type DateInputType = 'date' | 'time' | 'datetime-local' | 'month' | 'week';

export interface DateInputProps
  extends Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'size'>,
    VariantProps<typeof dateInputVariants> {
  type?: DateInputType;
  label?: string;
  error?: string;
  helperText?: string;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      type = 'date',
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
    const inputId = id || (label ? `date-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
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
        <div className="relative">
          <input
            ref={ref}
            type={type}
            id={inputId}
            className={dateInputVariants({
              size,
              className: `${hasError ? 'border-[var(--color-danger)] hover:border-[var(--color-danger)] focus:border-[var(--color-danger)]' : ''} ${className || ''}`,
            })}
            aria-invalid={hasError}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {/* Chevron icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="w-3 h-3 text-[var(--color-text-secondary)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="square" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
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
DateInput.displayName = 'DateInput';

export { dateInputVariants };
