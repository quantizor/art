/**
 * Growth Grid
 *
 * Flat Uint16Array occupancy grid for DLA crystal growth.
 * Each cell stores a seed ID (0 = empty).
 */

export class GrowthGrid {
  readonly width: number
  readonly height: number
  readonly resolution: number
  readonly data: Uint16Array

  constructor(width: number, height: number, resolution: number = 1) {
    this.width = width
    this.height = height
    this.resolution = resolution
    this.data = new Uint16Array(width * height)
  }

  /** Set a cell to a seed ID */
  set(cx: number, cy: number, seedId: number): void {
    this.data[cy * this.width + cx] = seedId
  }

  /** Get the seed ID at a cell (0 = empty) */
  get(cx: number, cy: number): number {
    return this.data[cy * this.width + cx]
  }

  /** Check if any 4-connected neighbor is occupied */
  hasNeighbor(cx: number, cy: number): boolean {
    const idx = cy * this.width + cx
    const w = this.width
    // Use bitwise OR for branch-free check
    return (
      ((cx > 0 ? this.data[idx - 1] : 0) |
        (cx < this.width - 1 ? this.data[idx + 1] : 0) |
        (cy > 0 ? this.data[idx - w] : 0) |
        (cy < this.height - 1 ? this.data[idx + w] : 0)) !==
      0
    )
  }

  /** Get seed ID of first occupied 4-connected neighbor (0 if none) */
  getNeighborSeedId(cx: number, cy: number): number {
    const idx = cy * this.width + cx
    const w = this.width
    if (cx > 0 && this.data[idx - 1]) return this.data[idx - 1]
    if (cx < this.width - 1 && this.data[idx + 1]) return this.data[idx + 1]
    if (cy > 0 && this.data[idx - w]) return this.data[idx - w]
    if (cy < this.height - 1 && this.data[idx + w]) return this.data[idx + w]
    return 0
  }

  /** Check if coordinates are within grid bounds */
  isInBounds(cx: number, cy: number): boolean {
    return cx >= 0 && cx < this.width && cy >= 0 && cy < this.height
  }

  /** Check if coordinates are safe for walker (1-cell margin from edges) */
  isSafeForWalker(cx: number, cy: number): boolean {
    return cx >= 1 && cx < this.width - 1 && cy >= 1 && cy < this.height - 1
  }

  /** Convert world coordinates to grid cell */
  worldToCell(wx: number, wy: number): { cx: number; cy: number } {
    return {
      cx: (wx * this.resolution) | 0,
      cy: (wy * this.resolution) | 0,
    }
  }

  /** Convert grid cell to world coordinates */
  cellToWorld(cx: number, cy: number): { wx: number; wy: number } {
    return {
      wx: cx / this.resolution,
      wy: cy / this.resolution,
    }
  }

  /** Clear all cells */
  clear(): void {
    this.data.fill(0)
  }
}
