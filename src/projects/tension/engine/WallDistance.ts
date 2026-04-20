/**
 * Wall-distance transform.
 *
 * For each filled cell, computes the distance to the nearest non-same-seed
 * cell (the cavity wall or a neighbouring nodule boundary). Uses the
 * two-pass 3-4 Chamfer algorithm — a close Euclidean approximation
 * that runs in linear time over the grid.
 *
 * Output units are Chamfer units where 3 ≈ 1 cell (cardinal step) and
 * 4 ≈ √2 cells (diagonal step). To convert to grid-cell units divide
 * by 3. Clamped to Uint16 (max ~65535 Chamfer units, plenty).
 */

const INF = 65535

/**
 * Compute wall-distance in Chamfer units.
 * Cells with gridData === 0 are "empty" and distance is 0.
 * Cells at the edge of the grid, or bordering a different seedId, are
 * initialised to 0 (they ARE the wall).
 */
export function computeWallDistance(
  gridData: Uint16Array,
  W: number,
  H: number
): Uint16Array {
  const N = W * H
  const dist = new Uint16Array(N)

  // Initialise: host-rock cells are 0 (they ARE wall); cells that border
  // a different-seed neighbour are 0. Edges of the grid are NOT treated
  // as walls — a cavity that extends off-screen continues naturally
  // rather than being truncated.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const s = gridData[idx]
      if (s === 0) {
        dist[idx] = 0
        continue
      }
      let isWall = false
      if (x > 0 && gridData[idx - 1] !== s) isWall = true
      else if (x < W - 1 && gridData[idx + 1] !== s) isWall = true
      else if (y > 0 && gridData[idx - W] !== s) isWall = true
      else if (y < H - 1 && gridData[idx + W] !== s) isWall = true
      dist[idx] = isWall ? 0 : INF
    }
  }

  // Forward pass (TL → BR): propagate from top-left neighbours.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      if (dist[idx] === 0) continue
      let d = dist[idx]
      if (y > 0) {
        if (x > 0 && dist[idx - W - 1] + 4 < d) d = dist[idx - W - 1] + 4
        if (dist[idx - W] + 3 < d) d = dist[idx - W] + 3
        if (x < W - 1 && dist[idx - W + 1] + 4 < d) d = dist[idx - W + 1] + 4
      }
      if (x > 0 && dist[idx - 1] + 3 < d) d = dist[idx - 1] + 3
      dist[idx] = d
    }
  }

  // Backward pass (BR → TL): propagate from bottom-right neighbours.
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const idx = y * W + x
      if (dist[idx] === 0) continue
      let d = dist[idx]
      if (x < W - 1 && dist[idx + 1] + 3 < d) d = dist[idx + 1] + 3
      if (y < H - 1) {
        if (x > 0 && dist[idx + W - 1] + 4 < d) d = dist[idx + W - 1] + 4
        if (dist[idx + W] + 3 < d) d = dist[idx + W] + 3
        if (x < W - 1 && dist[idx + W + 1] + 4 < d) d = dist[idx + W + 1] + 4
      }
      dist[idx] = d
    }
  }

  return dist
}

/** Find the maximum value in a wall-distance array (for reveal-threshold bounds). */
export function maxWallDist(dist: Uint16Array): number {
  let max = 0
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > max && dist[i] !== INF) max = dist[i]
  }
  return max
}

/**
 * Per-cell "within `radius` cells of an inter-seed Voronoi boundary"
 * mask. Adjacent nodules in nature have actual host rock between them,
 * so we render a dark crust along their shared boundary regardless of
 * whether the specimen's palette rolled a Mn shell — otherwise the
 * edge where two light-chalcedony cavities meet would merge invisibly.
 *
 * Distinct from computeWallDistance (which unifies host-rock and inter-
 * seed walls into one "wall" concept). Here only DIFFERENT non-zero
 * seedId neighbours count; host-rock edges are left alone.
 */
export function computeInterSeedMask(
  gridData: Uint16Array,
  W: number,
  H: number,
  radius: number
): Uint8Array {
  const N = W * H
  const mask = new Uint8Array(N)

  // Seed mask: cells with a different-seed 4-neighbour.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const s = gridData[idx]
      if (s === 0) continue
      if (
        (x > 0 && gridData[idx - 1] > 0 && gridData[idx - 1] !== s) ||
        (x < W - 1 && gridData[idx + 1] > 0 && gridData[idx + 1] !== s) ||
        (y > 0 && gridData[idx - W] > 0 && gridData[idx - W] !== s) ||
        (y < H - 1 && gridData[idx + W] > 0 && gridData[idx + W] !== s)
      ) {
        mask[idx] = 1
      }
    }
  }

  // Dilate `radius` times into same-cavity cells, using value 2 as a
  // next-pass sentinel so the dilation doesn't propagate through itself
  // within one pass.
  for (let r = 0; r < radius; r++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x
        if (gridData[idx] === 0 || mask[idx]) continue
        if (
          (x > 0 && mask[idx - 1] === 1) ||
          (x < W - 1 && mask[idx + 1] === 1) ||
          (y > 0 && mask[idx - W] === 1) ||
          (y < H - 1 && mask[idx + W] === 1)
        ) {
          mask[idx] = 2
        }
      }
    }
    for (let i = 0; i < N; i++) if (mask[i] === 2) mask[i] = 1
  }

  return mask
}
