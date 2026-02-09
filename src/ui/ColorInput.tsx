/**
 * ColorInput - Brutalist color picker component
 *
 * Custom styled color input with preview swatch.
 *
 * @example
 * <ColorInput label="Primary Color" value="#ea580c" onChange={handleChange} />
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react';

export interface ColorInputProps
  extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
  label?: string;
}

export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(
  ({ label, className, id, ...props }, ref) => {
    const inputId = id || (label ? `color-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

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
          type="color"
          id={inputId}
          className={`color-input w-12 h-10 appearance-none bg-black border border-[var(--color-border-default)] cursor-pointer transition-brutal hover:border-[var(--color-border-accent)] focus:outline-none focus:border-[var(--color-border-accent)] disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
          {...props}
        />
      </div>
    );
  }
);
ColorInput.displayName = 'ColorInput';
