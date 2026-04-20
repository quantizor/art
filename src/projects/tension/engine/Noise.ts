/**
 * Pure noise utilities — cellHash, value noise, fBM.
 *
 * Zero external dependencies so this module can be imported by Web
 * Workers and the main thread alike.
 */

/** Deterministic [0, 1) hash from an integer cell coordinate pair. */
export function cellHash(cx: number, cy: number): number {
  let h = (cx * 374761393 + cy * 668265263) | 0
  h = ((h ^ (h >> 13)) * 1274126177) | 0
  h = (h ^ (h >> 16)) | 0
  return ((h & 0xffff) >>> 0) / 0xffff
}

/** Bilinear-interpolated value noise in [0, 1]. */
export function valueNoise(x: number, y: number): number {
  let ix = x | 0
  if (x < 0 && x !== ix) ix -= 1
  let iy = y | 0
  if (y < 0 && y !== iy) iy -= 1

  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)

  const n00 = cellHash(ix, iy)
  const n10 = cellHash(ix + 1, iy)
  const n01 = cellHash(ix, iy + 1)
  const n11 = cellHash(ix + 1, iy + 1)

  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx
  return nx0 + (nx1 - nx0) * sy
}
