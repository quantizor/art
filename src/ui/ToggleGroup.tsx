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
  type Ref,
  createContext,
  useContext,
} from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { GroupSeparator } from './GroupSeparator';

// Context for managing toggle state. Discriminated on `type` so
// ToggleItem can narrow `value` without a cast.
type ToggleGroupContextValue = {
  onValueChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary';
} & ({ type: 'single'; value: string } | { type: 'multiple'; value: string[] });

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

interface ToggleGroupBaseProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'>,
    VariantProps<typeof toggleGroupVariants> {
  /**
   * Size of toggle items
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Visual variant
   */
  variant?: 'default' | 'primary';

  children: ReactNode;

  ref?: Ref<HTMLDivElement>;
}

/**
 * Discriminated on `type` so `value` and `onValueChange` narrow together:
 * "single" pairs a `string` value with a single-value callback, "multiple"
 * pairs a `string[]` value with an array callback.
 */
export type ToggleGroupProps = ToggleGroupBaseProps &
  (
    | {
        /** Only one item can be active (radio-like) */
        type: 'single';
        value: string;
        onValueChange: (value: string) => void;
      }
    | {
        /** Multiple items can be active (checkbox-like) */
        type: 'multiple';
        value: string[];
        onValueChange: (value: string[]) => void;
      }
  );

function ToggleGroup(props: ToggleGroupProps) {
  // `value` and `onValueChange` are pulled out only so they don't leak
  // into `domProps` (a <div> can't accept them); the narrowing-sensitive
  // logic below reads them back off `props` to keep type and value linked.
  const {
    type,
    value: _value,
    onValueChange: _onValueChange,
    size = 'md',
    variant = 'default',
    orientation,
    className,
    children,
    ref,
    ...domProps
  } = props;

  const handleItemClick = (itemValue: string) => {
    if (props.type === 'single') {
      props.onValueChange(itemValue);
    } else {
      const newValues = props.value.includes(itemValue)
        ? props.value.filter((v) => v !== itemValue)
        : [...props.value, itemValue];
      props.onValueChange(newValues);
    }
  };

  const contextValue: ToggleGroupContextValue =
    props.type === 'single'
      ? { type: 'single', value: props.value, onValueChange: handleItemClick, size, variant }
      : { type: 'multiple', value: props.value, onValueChange: handleItemClick, size, variant };

  return (
    <ToggleGroupContext.Provider value={contextValue}>
      <div
        ref={ref}
        role={type === 'single' ? 'radiogroup' : 'group'}
        className={toggleGroupVariants({
          orientation,
          className,
        })}
        {...domProps}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}
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
  const context = useToggleGroup();
  const { size, variant } = context;

  const isActive =
    context.type === 'single'
      ? context.value === value
      : context.value.includes(value);

  return (
    <button
      type="button"
      role={context.type === 'single' ? 'radio' : 'checkbox'}
      aria-checked={isActive}
      data-state={isActive ? 'on' : 'off'}
      className={toggleItemVariants({
        size,
        variant,
        active: isActive,
        className,
      })}
      onClick={() => context.onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  );
}

// Separator Component (wrapper for DiagonalDivider with proper height)
function ToggleSeparator() {
  const { size } = useToggleGroup();
  return <GroupSeparator size={size} />;
}

// Compound component: infer the merged type from the assignment itself,
// no cast needed.
const ToggleGroupWithSubs = Object.assign(ToggleGroup, {
  Item: ToggleItem,
  Separator: ToggleSeparator,
});

export { ToggleGroupWithSubs as ToggleGroup, ToggleItem, ToggleSeparator };

// Export variants
export { toggleGroupVariants, toggleItemVariants };
