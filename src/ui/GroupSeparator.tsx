import { DiagonalDivider } from './DiagonalDivider'

export type GroupControlSize = 'sm' | 'md' | 'lg'

const CONTROL_HEIGHTS: Record<GroupControlSize, string> = {
  lg: '3rem',
  md: '2.5rem',
  sm: '2rem',
}

/** Diagonal divider sized to the neighboring grouped controls. */
export function GroupSeparator({ size = 'md' }: { size?: GroupControlSize }) {
  return <DiagonalDivider height={CONTROL_HEIGHTS[size]} />
}
