/**
 * Slider - Brutalist range input component
 *
 * Custom styled range slider with accent track and thumb.
 *
 * @example
 * <Slider min={0} max={100} value={50} onChange={handleChange} />
 * <Slider label="Volume" min={0} max={100} />
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react';

export interface SliderProps
  extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
  label?: string;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ label, className, id, ...props }, ref) => {
    const inputId = id || (label ? `slider-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

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
          type="range"
          id={inputId}
          className={`slider-input w-full h-2 appearance-none bg-black border border-[var(--color-border-default)] cursor-pointer transition-brutal hover:border-[var(--color-border-accent)] focus:outline-none focus:border-[var(--color-border-accent)] disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
          {...props}
        />
      </div>
    );
  }
);
Slider.displayName = 'Slider';
