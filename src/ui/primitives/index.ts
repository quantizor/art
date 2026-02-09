/**
 * Design Tokens - TypeScript constants
 * Use these for programmatic access to design values
 */

// ============================================
// COLOR TOKENS
// ============================================

export const colors = {
  // Base
  black: '#000000',
  white: '#fafafa',

  // Primary orange scale (CP2077 warning/danger tones)
  orange: {
    700: '#c2410c',
    600: '#ea580c',
    500: '#f97316',
    400: '#fb923c',
    glow: 'rgba(234, 88, 12, 0.4)',
  },

  // Grayscale
  gray: {
    950: '#0a0a0a',
    900: '#171717',
    800: '#262626',
    700: '#404040',
    600: '#525252',
    500: '#737373',
    400: '#a3a3a3',
    300: '#d4d4d4',
    200: '#e5e5e5',
    100: '#f5f5f5',
  },

  // Accent colors
  cyan: '#06b6d4',
  yellow: '#eab308',
} as const;

// Semantic color aliases
export const semanticColors = {
  surface: {
    base: colors.black,
    elevated: colors.gray[950],
    card: colors.gray[950],
    cardHover: colors.gray[900],
  },
  text: {
    primary: colors.white,
    secondary: colors.gray[500],
    tertiary: colors.gray[600],
    inverse: colors.black,
  },
  border: {
    default: colors.gray[800],
    strong: colors.gray[500],
    accent: colors.orange[600],
  },
  primary: {
    default: colors.orange[600],
    hover: colors.orange[500],
    active: colors.orange[700],
    glow: colors.orange.glow,
  },
  status: {
    danger: colors.orange[600],
    warning: colors.yellow,
    info: colors.cyan,
  },
} as const;

// ============================================
// SPACING SCALE
// ============================================

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.5rem',    // 24px
  6: '2rem',      // 32px
  8: '3rem',      // 48px
  10: '4rem',     // 64px
} as const;

// ============================================
// TYPOGRAPHY TOKENS
// ============================================

export const typography = {
  fontFamily: {
    display: "'Chakra Petch', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, 'Cascadia Code', monospace",
  },
  fontSize: {
    xs: '0.6875rem',   // 11px
    sm: '0.75rem',     // 12px
    base: '0.875rem',  // 14px
    lg: '1rem',        // 16px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '2rem',     // 32px
  },
  letterSpacing: {
    wide: '0.05em',
    wider: '0.1em',
    widest: '0.15em',
  },
  lineHeight: {
    none: 1,
    tight: 1.25,
    normal: 1.5,
  },
} as const;

// ============================================
// BORDER TOKENS
// ============================================

export const borders = {
  width: {
    thin: '1px',
    default: '2px',
    thick: '3px',
    heavy: '4px',
  },
  radius: {
    none: '0',
  },
} as const;

// ============================================
// ANIMATION TOKENS
// ============================================

export const animation = {
  duration: {
    instant: '50ms',
    fast: '100ms',
    normal: '150ms',
    slow: '250ms',
  },
  easing: {
    linear: 'linear',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    digital: 'steps(4)',
  },
} as const;

// ============================================
// EFFECTS
// ============================================

export const effects = {
  notch: {
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
  clipPath: {
    notchSm: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
    notchMd: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)',
    notchLg: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)',
  },
} as const;

// ============================================
// Z-INDEX SCALE
// ============================================

export const zIndex = {
  base: 0,
  elevated: 10,
  dropdown: 100,
  modal: 1000,
  notification: 10000,
} as const;

// Type exports for TypeScript consumers
export type Color = typeof colors;
export type SemanticColor = typeof semanticColors;
export type Spacing = keyof typeof spacing;
export type FontSize = keyof typeof typography.fontSize;
export type BorderWidth = keyof typeof borders.width;
export type AnimationDuration = keyof typeof animation.duration;
