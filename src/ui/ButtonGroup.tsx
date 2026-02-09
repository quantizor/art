/**
 * ButtonGroup - Group of related buttons with diagonal separators
 *
 * Visual grouping of buttons with diagonal slash separators.
 * Useful for toolbars, action groups, and navigation.
 *
 * @example
 * <ButtonGroup>
 *   <Button variant="secondary">Edit</Button>
 *   <ButtonGroup.Separator />
 *   <Button variant="secondary">Delete</Button>
 *   <ButtonGroup.Separator />
 *   <Button variant="secondary">Share</Button>
 * </ButtonGroup>
 */

import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  createContext,
  useContext,
} from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { DiagonalDivider } from './DiagonalDivider';

// Context for button group
type ButtonGroupContextValue = {
  size?: 'sm' | 'md' | 'lg';
};

const ButtonGroupContext = createContext<ButtonGroupContextValue>({});

function useButtonGroup() {
  return useContext(ButtonGroupContext);
}

// Root ButtonGroup Component
const buttonGroupVariants = cva(
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
      attached: {
        true: '',
        false: 'gap-2',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
      attached: true,
    },
  }
);

export interface ButtonGroupProps
  extends ComponentPropsWithoutRef<'div'>,
    VariantProps<typeof buttonGroupVariants> {
  /**
   * Size hint for separator height matching
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Whether buttons are attached (no spacing) or detached (with gaps)
   */
  attached?: boolean;

  children: ReactNode;
}

export function ButtonGroup({
  size = 'md',
  orientation,
  attached,
  className,
  children,
  ...props
}: ButtonGroupProps) {
  return (
    <ButtonGroupContext.Provider value={{ size }}>
      <div
        role="group"
        className={buttonGroupVariants({
          orientation,
          attached,
          className,
        })}
        {...props}
      >
        {children}
      </div>
    </ButtonGroupContext.Provider>
  );
}

// Separator Component
export function ButtonGroupSeparator() {
  const { size } = useButtonGroup();

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

// Export compound component
ButtonGroup.Separator = ButtonGroupSeparator;

// Export variants
export { buttonGroupVariants };
