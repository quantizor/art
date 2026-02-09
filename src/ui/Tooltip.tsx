/**
 * Tooltip - Brutalist tooltip using CSS anchor positioning
 *
 * Uses modern CSS anchor positioning for zero-JavaScript positioning.
 * Falls back gracefully in browsers without support.
 *
 * @example
 * <Tooltip content="This is a tooltip">
 *   <Button>Hover me</Button>
 * </Tooltip>
 */

import {
  useState,
  useId,
  type ReactNode,
  type CSSProperties,
} from 'react';

export interface TooltipProps {
  /**
   * The content to display in the tooltip
   */
  content: ReactNode;
  /**
   * The trigger element
   */
  children: ReactNode;
  /**
   * Preferred position of the tooltip
   * @default 'top'
   */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Delay before showing tooltip in ms
   * @default 200
   */
  delay?: number;
}

const positionAreaMap = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
} as const;

// Offset margins for each position
const offsetMap = {
  top: { marginBottom: '8px' },
  bottom: { marginTop: '8px' },
  left: { marginRight: '8px' },
  right: { marginLeft: '8px' },
} as const;

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const anchorName = `--tooltip-${useId().replace(/:/g, '')}`;

  const showTooltip = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  // CSS custom properties for anchor positioning
  const triggerStyle: CSSProperties = {
    anchorName,
  } as CSSProperties;

  const tooltipStyle = {
    positionAnchor: anchorName,
    positionArea: positionAreaMap[position],
    ...offsetMap[position],
  } as CSSProperties;

  return (
    <div className="relative inline-block">
      {/* Trigger */}
      <div
        style={triggerStyle}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>

      {/* Tooltip */}
      {isVisible && (
        <div
          role="tooltip"
          className="fixed z-50 px-3 py-1.5 text-display text-sm bg-[var(--color-surface-card)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] whitespace-nowrap pointer-events-none animate-in fade-in duration-150"
          style={tooltipStyle}
        >
          {content}
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-[var(--color-surface-card)] border-[var(--color-border-default)] rotate-45 ${
              position === 'top'
                ? 'bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r'
                : position === 'bottom'
                  ? 'top-[-5px] left-1/2 -translate-x-1/2 border-t border-l'
                  : position === 'left'
                    ? 'right-[-5px] top-1/2 -translate-y-1/2 border-t border-r'
                    : 'left-[-5px] top-1/2 -translate-y-1/2 border-b border-l'
            }`}
          />
        </div>
      )}
    </div>
  );
}
