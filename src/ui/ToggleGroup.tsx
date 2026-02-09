/**
 * ToggleGroup - Brutalist toggle group with diagonal separators
 *
 * Single-select or multi-select toggle button group.
 * Features diagonal slash separators between items for visual interest.
 *
 * @example
 * // Single select (radio-like)
 * <ToggleGroup type="single" value={value} onValueChange={setValue}>
 *   <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
 *   <ToggleGroup.Item value="list">List</ToggleGroup.Item>
 * </ToggleGroup>
 *
 * // Multi select (checkbox-like)
 * <ToggleGroup type="multiple" value={values} onValueChange={setValues}>
 *   <ToggleGroup.Item value="featured">Featured</ToggleGroup.Item>
 *   <ToggleGroup.Item value="recent">Recent</ToggleGroup.Item>
 * </ToggleGroup>
 */

import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  createContext,
  useContext,
  forwardRef,
} from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { DiagonalDivider } from './DiagonalDivider';

// Context for managing toggle state
type ToggleGroupContextValue = {
  type: 'single' | 'multiple';
  value: string | string[];
  onValueChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary';
};

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

function useToggleGroup() {
  const context = useContext(ToggleGroupContext);
  if (!context) {
    throw new Error('ToggleGroup.Item must be used within ToggleGroup');
  }
  return context;
}

// Root ToggleGroup Component
const toggleGroupVariants = cva(
  [
    'inline-flex items-stretch',
    'border-solid border border-[var(--color-border-default)]',
    'bg-[var(--color-surface-card)]',
    'overflow-hidden',
  ].join(' '),
  {
    variants: {
      orientation: {
        horizontal: 'flex-row',
        vertical: 'flex-col',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
);

export interface ToggleGroupProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'>,
    VariantProps<typeof toggleGroupVariants> {
  /**
   * Type of toggle group
   * - "single": Only one item can be active (radio-like)
   * - "multiple": Multiple items can be active (checkbox-like)
   */
  type: 'single' | 'multiple';

  /**
   * Current value(s)
   * - string for single type
   * - string[] for multiple type
   */
  value: string | string[];

  /**
   * Callback when value changes
   */
  onValueChange: (value: string | string[]) => void;

  /**
   * Size of toggle items
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Visual variant
   */
  variant?: 'default' | 'primary';

  children: ReactNode;
}

const ToggleGroup = forwardRef<HTMLDivElement, ToggleGroupProps>(
  (
    {
      type,
      value,
      onValueChange,
      size = 'md',
      variant = 'default',
      orientation,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const handleItemClick = (itemValue: string) => {
      if (type === 'single') {
        onValueChange(itemValue);
      } else {
        const currentValues = value as string[];
        const newValues = currentValues.includes(itemValue)
          ? currentValues.filter((v) => v !== itemValue)
          : [...currentValues, itemValue];
        onValueChange(newValues);
      }
    };

    return (
      <ToggleGroupContext.Provider
        value={{
          type,
          value,
          onValueChange: handleItemClick,
          size,
          variant,
        }}
      >
        <div
          ref={ref}
          role={type === 'single' ? 'radiogroup' : 'group'}
          className={toggleGroupVariants({
            orientation,
            className,
          })}
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    );
  }
);
ToggleGroup.displayName = 'ToggleGroup';

// Toggle Item Component
const toggleItemVariants = cva(
  [
    'relative',
    'text-brutal',
    'cursor-pointer select-none',
    'transition-brutal',
    'focus-visible:outline-none focus-visible:z-10',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
      variant: {
        default: '',
        primary: '',
      },
      active: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      // Default variant states
      {
        variant: 'default',
        active: false,
        className: [
          'bg-transparent',
          'text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-surface-elevated)]',
          'hover:text-[var(--color-text-primary)]',
        ].join(' '),
      },
      {
        variant: 'default',
        active: true,
        className: [
          'bg-[var(--color-primary)]',
          'text-[var(--color-text-inverse)]',
        ].join(' '),
      },
      // Primary variant states (same as default for now)
      {
        variant: 'primary',
        active: false,
        className: [
          'bg-transparent',
          'text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-surface-elevated)]',
          'hover:text-[var(--color-primary)]',
        ].join(' '),
      },
      {
        variant: 'primary',
        active: true,
        className: [
          'bg-[var(--color-primary)]',
          'text-[var(--color-text-inverse)]',
        ].join(' '),
      },
    ],
    defaultVariants: {
      size: 'md',
      variant: 'default',
      active: false,
    },
  }
);

export interface ToggleItemProps extends ComponentPropsWithoutRef<'button'> {
  value: string;
  children: ReactNode;
}

function ToggleItem({ value, children, className, ...props }: ToggleItemProps) {
  const { type, value: groupValue, onValueChange, size, variant } = useToggleGroup();

  const isActive =
    type === 'single'
      ? groupValue === value
      : (groupValue as string[]).includes(value);

  return (
    <button
      type="button"
      role={type === 'single' ? 'radio' : 'checkbox'}
      aria-checked={isActive}
      data-state={isActive ? 'on' : 'off'}
      className={toggleItemVariants({
        size,
        variant,
        active: isActive,
        className,
      })}
      onClick={() => onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  );
}

// Separator Component (wrapper for DiagonalDivider with proper height)
function ToggleSeparator() {
  const { size } = useToggleGroup();

  const heightMap = {
    sm: '2rem',    // h-8
    md: '2.5rem',  // h-10
    lg: '3rem',    // h-12
  };

  return (
    <DiagonalDivider
      color="default"
      variant="default"
      height={heightMap[size || 'md']}
    />
  );
}

// Compound component type
type ToggleGroupComponent = typeof ToggleGroup & {
  Item: typeof ToggleItem;
  Separator: typeof ToggleSeparator;
};

// Attach subcomponents
(ToggleGroup as ToggleGroupComponent).Item = ToggleItem;
(ToggleGroup as ToggleGroupComponent).Separator = ToggleSeparator;

// Export compound component
const ToggleGroupWithSubs = ToggleGroup as ToggleGroupComponent;
export { ToggleGroupWithSubs as ToggleGroup, ToggleItem, ToggleSeparator };

// Export variants
export { toggleGroupVariants, toggleItemVariants };
