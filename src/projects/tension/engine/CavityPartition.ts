/**
 * Cavity partition — synchronous SDF-based Voronoi with capped radii.
 *
 * Real agate nodules form in pre-existing cavities of the host basalt,
 * surrounded by unmineralised rock. Each seed defines its own cavity
 * shape: an ellipsoid lumpy-warped by fBM, capped at a maximum radius.
 * Cells inside the warped cap go to the closest seed (in warped metric);
 * cells outside any cavity remain 0 (host rock).
 *
 * The partition is computed in one synchronous pass — no animation.
 * The visible animation is the inward reveal that follows.
 */

import { valueNoise } from './Noise'
import type { Seed } from '../types'

export interface CavityPartitionResult {
  /** Per-cell seedId (0 = host rock between cavities) */
  gridData: Uint16Array
  /** Bounding box in cells per seed for fast lookup later */
  seedBBox: Map<number, { x0: number; y0: number; x1: number; y1: number }>
}

/**
 * Compute the cavity partition. O(N · S) but with bounding-box culling
 * each pixel only evaluates against the few seeds whose cap reaches it.
 */
export function partitionCavities(
  seeds: readonly Seed[],
  W: number,
  H: number,
  noiseScale: number,
  warpStrength: number
): CavityPartitionResult {
  const N = W * H
  const gridData = new Uint16Array(N)
  const seedBBox = new Map<number, { x0: number; y0: number; x1: number; y1: number }>()

  // Precompute per-seed bbox + axis trig for speed.
  type Compiled = {
    seed: Seed
    cosA: number
    sinA: number
    rMax: number
    rMax2: number
    bboxX0: number
    bboxY0: number
    bboxX1: number
    bboxY1: number
  }

  const compiled: Compiled[] = seeds.map((s) => {
    const orient = s.axes[0] ?? 0
    // Generous bbox: rMax + warp slack.
    const slack = Math.ceil(s.maxRadius * 0.35) + 8
    const r = s.maxRadius * Math.max(s.aspectRatio, 1) + slack
    return {
      seed: s,
      cosA: Math.cos(orient),
      sinA: Math.sin(orient),
      rMax: s.maxRadius,
      rMax2: s.maxRadius * s.maxRadius,
      bboxX0: Math.max(0, Math.floor(s.x - r)),
      bboxY0: Math.max(0, Math.floor(s.y - r)),
      bboxX1: Math.min(W - 1, Math.ceil(s.x + r)),
      bboxY1: Math.min(H - 1, Math.ceil(s.y + r)),
    }
  })

  for (const c of compiled) {
    seedBBox.set(c.seed.id, { x0: c.bboxX0, y0: c.bboxY0, x1: c.bboxX1, y1: c.bboxY1 })
  }

  // Walk every cell; for each, find the seed whose warped distance is
  // smallest AND within that seed's cap. Skip seeds whose bbox excludes
  // this cell — most cells only test 1-2 seeds.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let bestId = 0
      let bestDist = Infinity

      for (let si = 0; si < compiled.length; si++) {
        const c = compiled[si]
        if (x < c.bboxX0 || x > c.bboxX1 || y < c.bboxY0 || y > c.bboxY1) continue

        const seed = c.seed
        const dx = x - seed.x
        const dy = y - seed.y
        // Rotate into seed-local frame and apply aspect ratio.
        const rdx = dx * c.cosA - dy * c.sinA
        const rdy = (dx * c.sinA + dy * c.cosA) * seed.aspectRatio
        const d2 = rdx * rdx + rdy * rdy
        // Cheap pre-filter: well outside even with warp slack.
        if (d2 > c.rMax2 * 1.6) continue
        const d = Math.sqrt(d2)
        // Single low-frequency warp — produces gentle large-scale
        // lobes (kidney shapes) without sub-shell-width chatter that
        // would punch holes through the dark Mn rim.
        const ns = noiseScale
        const nx = rdx * ns + seed.noiseOffsetX
        const ny = rdy * ns + seed.noiseOffsetY
        const warp = (valueNoise(nx, ny) - 0.5)
        const warped = d + warp * c.rMax * warpStrength
        if (warped > c.rMax) continue
        if (warped < bestDist) {
          bestDist = warped
          bestId = seed.id
        }
      }

      if (bestId > 0) gridData[y * W + x] = bestId
    }
  }

  // Connectivity cleanup — keep only the connected component of each
  // seed that contains the seed's centre. SDF partitions can leave
  // isolated pockets where one seed barely wins inside another's
  // territory; those read as "nanoagates" floating near big ones and
  // never form in real cavities.
  const visited = new Uint8Array(N)
  const queue = new Int32Array(N)
  for (const s of seeds) {
    const sx = Math.round(s.x)
    const sy = Math.round(s.y)
    if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue
    const startIdx = sy * W + sx
    if (gridData[startIdx] !== s.id) continue
    let head = 0
    let tail = 0
    queue[tail++] = startIdx
    visited[startIdx] = 1
    while (head < tail) {
      const idx = queue[head++]
      const y = (idx / W) | 0
      const x = idx - y * W
      // 4-neighbour flood
      if (x > 0) {
        const ni = idx - 1
        if (!visited[ni] && gridData[ni] === s.id) { visited[ni] = 1; queue[tail++] = ni }
      }
      if (x < W - 1) {
        const ni = idx + 1
        if (!visited[ni] && gridData[ni] === s.id) { visited[ni] = 1; queue[tail++] = ni }
      }
      if (y > 0) {
        const ni = idx - W
        if (!visited[ni] && gridData[ni] === s.id) { visited[ni] = 1; queue[tail++] = ni }
      }
      if (y < H - 1) {
        const ni = idx + W
        if (!visited[ni] && gridData[ni] === s.id) { visited[ni] = 1; queue[tail++] = ni }
      }
    }
  }
  // Any cell claimed by a seed but not visited → orphan, reset to host rock.
  for (let i = 0; i < N; i++) {
    if (gridData[i] !== 0 && !visited[i]) gridData[i] = 0
  }

  // Morphological opening — erode then dilate each seed's region so
  // tendrils thinner than ~2·OPENING_RADIUS cells get cut back to
  // host rock. Prunes "peninsula" artefacts where a seed's Voronoi
  // territory was pinched into a thin strip by neighbouring seeds.
  // Bulk nodule shapes are preserved (thick interior stays thick).
  morphologicalOpening(gridData, W, H, 3)

  return { gridData, seedBBox }
}

/**
 * Binary morphological opening (erode → dilate) per-seed. A cell
 * "erodes" if it isn't `radius` cells deep in all four cardinal
 * directions of its own seed. The erode set then dilates back up to
 * `radius` via same-seed BFS, so thick shapes return to their full
 * silhouette but thin strips (which had no eroded core) stay culled.
 */
function morphologicalOpening(
  gridData: Uint16Array,
  W: number,
  H: number,
  radius: number
): void {
  const N = W * H
  const survivors = new Uint8Array(N)
  const queue = new Int32Array(N)
  const depth = new Uint8Array(N)
  let tail = 0

  // Erode: thick cells are those with same-seed neighbours `radius`
  // cells away in each cardinal direction. Cheaper than a full disk
  // check and good enough to detect strips narrower than 2·radius.
  for (let y = radius; y < H - radius; y++) {
    for (let x = radius; x < W - radius; x++) {
      const idx = y * W + x
      const s = gridData[idx]
      if (s === 0) continue
      if (
        gridData[idx - radius] === s &&
        gridData[idx + radius] === s &&
        gridData[idx - radius * W] === s &&
        gridData[idx + radius * W] === s
      ) {
        survivors[idx] = 1
        depth[idx] = 0
        queue[tail++] = idx
      }
    }
  }

  // Dilate: BFS from survivors to depth `radius`, only into same-seed
  // cells of the original grid. Cells reachable within radius of a
  // thick core stay; everything else gets culled.
  let head = 0
  while (head < tail) {
    const idx = queue[head++]
    const d = depth[idx]
    if (d >= radius) continue
    const s = gridData[idx]
    const y = (idx / W) | 0
    const x = idx - y * W
    if (x > 0) {
      const ni = idx - 1
      if (!survivors[ni] && gridData[ni] === s) {
        survivors[ni] = 1; depth[ni] = d + 1; queue[tail++] = ni
      }
    }
    if (x < W - 1) {
      const ni = idx + 1
      if (!survivors[ni] && gridData[ni] === s) {
        survivors[ni] = 1; depth[ni] = d + 1; queue[tail++] = ni
      }
    }
    if (y > 0) {
      const ni = idx - W
      if (!survivors[ni] && gridData[ni] === s) {
        survivors[ni] = 1; depth[ni] = d + 1; queue[tail++] = ni
      }
    }
    if (y < H - 1) {
      const ni = idx + W
      if (!survivors[ni] && gridData[ni] === s) {
        survivors[ni] = 1; depth[ni] = d + 1; queue[tail++] = ni
      }
    }
  }

  // Cull non-survivors back to host rock.
  for (let i = 0; i < N; i++) {
    if (gridData[i] !== 0 && !survivors[i]) gridData[i] = 0
  }
}
