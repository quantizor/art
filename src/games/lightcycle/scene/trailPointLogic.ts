/**
 * Pure trail point spacing helpers.
 * Kept free of Three.js so spacing and ribbon layout stay unit-testable.
 */

/** How often to add new control points (world units of travel) */
export const POINT_SPACING = 2.0
export const VERTICES_PER_POINT = 4
export const INDICES_PER_SEGMENT = 18

export interface TrailVec3 {
  x: number
  y: number
  z: number
}

export function distanceBetween(a: TrailVec3, b: TrailVec3): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Accumulate travel since the last control point.
 * Returns the new accumulator value.
 */
export function accumulateTravel(
  previous: TrailVec3 | null,
  next: TrailVec3,
  distanceSinceLastPoint: number,
): number {
  if (!previous) return distanceSinceLastPoint
  return distanceSinceLastPoint + distanceBetween(previous, next)
}

/** Whether travel since the last point is enough to place a new control point. */
export function shouldAddControlPoint(
  distanceSinceLastPoint: number,
  spacing: number = POINT_SPACING,
): boolean {
  return distanceSinceLastPoint >= spacing
}

/**
 * Triangle indices for a fixed-capacity trail ribbon.
 *
 * Each control point contributes 4 vertices (left-bottom, left-top,
 * right-bottom, right-top); each pair of adjacent points contributes 3
 * quads (left face, right face, top cap), independent of how many of the
 * `maxPoints` control points are actually in use. `TrailRenderer` allocates
 * this once per mesh capacity and narrows the draw range instead of
 * rebuilding the index buffer every frame.
 */
export function buildTrailIndices(maxPoints: number): number[] {
  const indices: number[] = []
  for (let i = 0; i < maxPoints - 1; i++) {
    const a = i * VERTICES_PER_POINT       // current point base
    const b = (i + 1) * VERTICES_PER_POINT // next point base
    // Vertex layout per point: 0=LB, 1=LT, 2=RB, 3=RT

    // Left face (facing outward-left)
    indices.push(a + 0, b + 0, a + 1)
    indices.push(a + 1, b + 0, b + 1)

    // Right face (facing outward-right)
    indices.push(a + 2, a + 3, b + 2)
    indices.push(a + 3, b + 3, b + 2)

    // Top cap (facing up)
    indices.push(a + 1, b + 1, a + 3)
    indices.push(a + 3, b + 1, b + 3)
  }
  return indices
}
