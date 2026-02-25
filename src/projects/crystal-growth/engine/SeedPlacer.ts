/**
 * Seed Placer
 *
 * Poisson disk sampling for crystal nucleation sites.
 * Pure function — no side effects, fully testable.
 */

export interface SeedPosition {
  x: number
  y: number
}

/**
 * Generate seed positions using rejection-based Poisson disk sampling.
 *
 * Produces `count` positions where no two points are closer than `minDistance`.
 * Falls back to best-effort if the grid can't fit all requested seeds.
 *
 * @param count - Desired number of seeds
 * @param gridW - Grid width
 * @param gridH - Grid height
 * @param minDistance - Minimum distance between any two seeds
 * @param margin - Margin from grid edges (default 10)
 */
export function generateSeedPositions(
  count: number,
  gridW: number,
  gridH: number,
  minDistance: number,
  margin = 10
): SeedPosition[] {
  const positions: SeedPosition[] = []
  const maxAttempts = count * 100

  const minX = margin
  const maxX = gridW - margin
  const minY = margin
  const maxY = gridH - margin
  const minDist2 = minDistance * minDistance

  let attempts = 0
  while (positions.length < count && attempts < maxAttempts) {
    attempts++
    const x = minX + Math.random() * (maxX - minX)
    const y = minY + Math.random() * (maxY - minY)

    let tooClose = false
    for (const p of positions) {
      const dx = x - p.x
      const dy = y - p.y
      if (dx * dx + dy * dy < minDist2) {
        tooClose = true
        break
      }
    }

    if (!tooClose) {
      positions.push({ x: Math.round(x), y: Math.round(y) })
    }
  }

  return positions
}
