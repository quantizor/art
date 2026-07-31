/**
 * Color Mapper
 *
 * Maps crystal growth parameters to birefringence-inspired colors.
 * All color generation uses OKLCH color space for perceptual uniformity.
 * Pure functions — no side effects, fully testable.
 *
 * Two growth patterns:
 * - 'linear': color gradient projected along the crystal axis
 * - 'radial': concentric color gradient from center outward
 *
 * Both patterns use gentle sweep strength (at most 1-2 color transitions
 * per grain) with subtle jitter for organic irregularity.
 *
 * Performance: hot-path functions avoid object allocation and use
 * precomputed LUTs for trig and gamma to minimize per-pixel cost.
 */

import type { ColorParams, CrystalProfile } from '../types'
import { getStrategy, type BandColor, type BandColorStrategy } from './color-strategy'
import { profile as agateProfile } from '../profiles'
import { configureAgateExperimental, setBandRng } from './agate-experimental'
import type { PRNG } from './SeededRandom'

// ─── Precomputed Lookup Tables ──────────────────────────────────
// Built once at module load. Eliminates Math.sin/cos/pow from hot paths.

/** Sin/cos LUT for integer degrees 0-359 (used by oklchToRgb) */
const SIN_DEG = new Float64Array(360)
const COS_DEG = new Float64Array(360)
for (let i = 0; i < 360; i++) {
  const rad = (i * Math.PI) / 180
  SIN_DEG[i] = Math.sin(rad)
  COS_DEG[i] = Math.cos(rad)
}

/**
 * Gamma LUT: linearToSrgb for 4096 uniform steps in [0, 1].
 * Indexed as gammaLUT[Math.round(clamp01(linearValue) * 4095)].
 * Max error vs exact: ~0.00025 (invisible at 8-bit quantization).
 */
const GAMMA_LUT_SIZE = 4096
const GAMMA_LUT = new Float64Array(GAMMA_LUT_SIZE)
for (let i = 0; i < GAMMA_LUT_SIZE; i++) {
  const x = i / (GAMMA_LUT_SIZE - 1)
  GAMMA_LUT[i] = x <= 0.0031308
    ? 12.92 * x
    : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

/** Fast gamma via LUT — avoids Math.pow in hot path */
function linearToSrgbFast(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return GAMMA_LUT[(x * (GAMMA_LUT_SIZE - 1) + 0.5) | 0]
}

// ─── Active Profile ──────────────────────────────────────────
// Module-level singleton — mirrors the existing activeStrategy pattern.

let currentProfile: CrystalProfile = agateProfile
let currentStrategy: BandColorStrategy = getStrategy(currentProfile.colorStrategyName)
/** Precomputed 2^(-bandH) — avoids Math.pow per pixel in hot path */
let bandPwHL: number = Math.pow(2, -currentProfile.bandH)

/** Switch the active crystal profile (invalidates all caches) */
export function setActiveProfile(
  profile: CrystalProfile,
  agateRng?: PRNG,
  bandRng?: PRNG
): void {
  currentProfile = profile
  currentStrategy = getStrategy(profile.colorStrategyName)
  bandPwHL = Math.pow(2, -profile.bandH)
  configureAgateExperimental(profile, agateRng)
  if (bandRng) setBandRng(bandRng)
  invalidateBandCache()
}

/** Get the current active profile */
export function getActiveProfile(): CrystalProfile {
  return currentProfile
}

// ─── Band Width Cache ──────────────────────────────────────────

/** Max bands we precompute (covers distances up to MAX_BANDS * maxBandWidth) */
const MAX_BANDS = 512

// ─── Band-group cache (per hueKey+seedId) ─────────────────────
// For the enhanced intra-band gradient, consecutive same-family
// bands must be treated as one continuous deposit. Walking both
// directions per pixel costs ~10 extra getBandColor calls per cell;
// precomputing the group extents once per seed turns each lookup
// into a Uint16Array read. Cleared alongside the width cache in
// invalidateBandCache().
const groupCache: Map<number, { start: Uint16Array; end: Uint16Array }> = new Map()

function seedGroupKey(hueKey: number, seedId: number): number {
  return ((hueKey & 0xffff) << 16) | (seedId & 0xffff)
}

function getBandGroups(
  hueKey: number, seedId: number,
  baseLightness: number, saturation: number
): { start: Uint16Array; end: Uint16Array } {
  const key = seedGroupKey(hueKey, seedId)
  const cached = groupCache.get(key)
  if (cached) {
    return cached
  }
  const start = new Uint16Array(MAX_BANDS)
  const end = new Uint16Array(MAX_BANDS)
  const L_CLOSE = 0.06
  const C_CLOSE = 0.04
  const H_CLOSE = 15
  // Band 0 is the Mn/host-rock shell — mineralogically distinct from
  // any band 1+ chemistry, so never absorb it into a group.
  start[0] = 0
  end[0] = 0
  if (MAX_BANDS > 1) {
    start[1] = 1
    // Forward pass over bands 2..N: groupStart[i] = first band in i's run.
    let curStart = 1
    let prev = currentStrategy.getBandColor(1, hueKey, seedId, baseLightness, saturation)
    for (let i = 2; i < MAX_BANDS; i++) {
      const c = currentStrategy.getBandColor(i, hueKey, seedId, baseLightness, saturation)
      let same = Math.abs(prev.L - c.L) < L_CLOSE && Math.abs(prev.C - c.C) < C_CLOSE
      if (same && prev.C >= 0.015 && c.C >= 0.015) {
        let d = prev.H - c.H
        if (d > 180) d -= 360
        else if (d < -180) d += 360
        if (Math.abs(d) >= H_CLOSE) same = false
      }
      if (!same) curStart = i
      start[i] = curStart
      prev = c
    }
    // Backward pass over bands N..1: groupEnd[i] = last band in i's run.
    end[MAX_BANDS - 1] = MAX_BANDS - 1
    let curEnd = MAX_BANDS - 1
    prev = currentStrategy.getBandColor(MAX_BANDS - 1, hueKey, seedId, baseLightness, saturation)
    for (let i = MAX_BANDS - 2; i >= 1; i--) {
      const c = currentStrategy.getBandColor(i, hueKey, seedId, baseLightness, saturation)
      let same = Math.abs(c.L - prev.L) < L_CLOSE && Math.abs(c.C - prev.C) < C_CLOSE
      if (same && c.C >= 0.015 && prev.C >= 0.015) {
        let d = c.H - prev.H
        if (d > 180) d -= 360
        else if (d < -180) d += 360
        if (Math.abs(d) >= H_CLOSE) same = false
      }
      if (!same) curEnd = i
      end[i] = curEnd
      prev = c
    }
  }
  const groups = { start, end }
  groupCache.set(key, groups)
  return groups
}

/**
 * Per-(hueKey, baseWidth) cumulative band-width cache. Evicted when a new
 * palette is set.
 */
interface BandCumulativeSlot {
  key: number
  baseWidth: number
  cumulative: Float64Array
}
let bandCache: BandCumulativeSlot | null = null

/**
 * Decide if a nodule uses "single-feedback zone" layout (Malawi-style):
 * one very fat quiet chalcedony band, then a tight cluster of thin accent
 * bands, then a compressed central eye. Deterministic per hueKey so the
 * generator and width arrays agree.
 */
/** User-selected preset override. Forces all seeds into one variant. */
export const VARIANT_PRESETS = ['random', 'iris', 'onyx', 'zonal', 'dyed'] as const
export type VariantPreset = (typeof VARIANT_PRESETS)[number]

let variantOverride: VariantPreset = 'random'

export function setVariantOverride(v: VariantPreset): void {
  variantOverride = v
}

export function isZonalLayout(hueKey: number): boolean {
  if (variantOverride === 'zonal') return true
  if (variantOverride !== 'random') return false
  return cellHash(hueKey, 7919) < 0.55
}

export function isOnyxLayout(hueKey: number): boolean {
  if (variantOverride === 'onyx') return true
  if (variantOverride !== 'random') return false
  return cellHash(hueKey, 5503) < 0.20
}

export function isDyedSpecimen(hueKey: number): boolean {
  if (variantOverride === 'dyed') return true
  if (variantOverride !== 'random') return false
  return cellHash(hueKey, 2749) < 0.05
}

export function isIrisLayout(hueKey: number): boolean {
  if (variantOverride === 'iris') return true
  if (variantOverride !== 'random') return false
  return cellHash(hueKey, 3607) < 0.15
}

/** Stable 0..N-1 palette index for an iris seed. Indexed by both
 *  hueKey and seedId so each nodule in an iris specimen picks its own
 *  pride palette (two-nodule iris pairs can show two different flags). */
export function getIrisPaletteIdx(hueKey: number, seedId: number, paletteCount: number): number {
  return (cellHash(hueKey, seedId + 8191) * paletteCount) | 0
}

/**
 * Get or build the cumulative band-width array for a given hueKey + baseWidth.
 * Returns a Float64Array where entry[i] = sum of widths for bands 0..i.
 */
function getBandCumulative(hueKey: number, baseWidth: number): Float64Array {
  const slot = bandCache
  if (slot && slot.key === hueKey && slot.baseWidth === baseWidth) {
    return slot.cumulative
  }

  const cum = new Float64Array(MAX_BANDS)
  let acc = 0
  // Flat-uniform band widths with modest jitter. Real agate bands are
  // roughly constant thickness across a specimen (the 1D Jablczynski
  // geometric ramp doesn't apply to closed 2D cavities). Occasional
  // thin accent bands provide visual interest.
  const [widthMin, widthMax] = currentProfile.bandWidthVariation
  const widthRange = widthMax - widthMin
  const thinFrequency = currentProfile.bandThinFrequency
  const thinWidth = currentProfile.bandThinWidth

  const zonal = isZonalLayout(hueKey)
  const onyx = isOnyxLayout(hueKey)
  for (let i = 0; i < MAX_BANDS; i++) {
    let widthFactor: number
    if (onyx) {
      // Dramatic onyx width swings — hair-thin seams next to fat 4-5×
      // bands, nothing in between. The central pool is a single very
      // fat black band (index 11+) that eats the rest of the cavity.
      if (i === 0) {
        widthFactor = 1.0 + cellHash(i + 910, hueKey) * 0.5
      } else if (i >= 11) {
        widthFactor = 60 // solid central pool — always exceeds remaining radius
      } else {
        const r = cellHash(i + 900, hueKey)
        widthFactor = r < 0.30
          ? 0.20 + cellHash(i + 901, hueKey) * 0.35        // hair seam
          : r < 0.65
            ? 3.0 + cellHash(i + 902, hueKey) * 2.5        // fat band
            : 0.8 + cellHash(i + 903, hueKey) * 1.2        // normal
      }
    } else if (zonal && i === 1) {
      // Fat quiet zone: the single-feedback expanse, 14-22x a normal band.
      widthFactor = 14 + cellHash(i + 700, hueKey) * 8
    } else if (zonal && i >= 2 && i <= 7) {
      // Accent cluster between the fat zone and the central eye.
      widthFactor = 0.9 + cellHash(i + 800, hueKey) * 0.8
    } else {
      widthFactor = widthMin + cellHash(i + 200, hueKey) * widthRange
      if (thinFrequency > 0 && cellHash(i + 500, hueKey) < thinFrequency) {
        widthFactor *= thinWidth
      }
    }
    // Band 0 gets a generous width boost so the Mn/basalt rind reads
    // at roughly 1-2% of nodule diameter — consistent with real agate
    // rind thicknesses (~1-3 mm on a 5-15 cm nodule).
    const shellBoost = i === 0 ? 3.2 : 1.0
    acc += baseWidth * widthFactor * shellBoost
    cum[i] = acc
  }

  bandCache = { key: hueKey, baseWidth, cumulative: cum }
  return cum
}

/**
 * Binary search for band index: find the smallest i such that
 * cumulative[i] >= absDist.
 */
function findBandIndex(cumulative: Float64Array, absDist: number): number {
  let lo = 0
  let hi = MAX_BANDS - 1
  // Fast exit: if absDist is in the first band, skip the search
  if (absDist <= cumulative[0]) return 0
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cumulative[mid] < absDist) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

// ─── Core Functions ──────────────────────────────────────────

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

// ─── OKLCH -> sRGB Conversion ──────────────────────────────────

export { cellHash, valueNoise } from './Noise'
import { cellHash, valueNoise } from './Noise'

// ─── Direct-to-Buffer Color Computation ──────────────────────
// Eliminates all intermediate RGBColor allocations in the hot path.
// Writes final RGBA bytes directly to a Uint8Array at a given offset.

/**
 * Precomputed per-seed tilt data. Compute once per seed, reuse for
 * all cells in that seed. Avoids redundant Math.cos/pow per cell.
 */
export interface SeedTiltData {
  grainBrightness: number
  colorRetention: number
  /** cos of primary axis orientation — used to rotate fBM warp into seed-local frame */
  cosOrient: number
  /** sin of primary axis orientation */
  sinOrient: number
  /** fBM noise-space X offset (decorrelates warp between seeds) */
  noiseOffsetX: number
  /** fBM noise-space Y offset */
  noiseOffsetY: number
}

/** Precompute tilt + warp-frame values for a seed (call once per seed) */
export function precomputeSeedTilt(seed: { tilt: number; axes: number[]; noiseOffsetX: number; noiseOffsetY: number }): SeedTiltData {
  const cosTilt = Math.cos(seed.tilt)
  const cos2Tilt = cosTilt * cosTilt
  const [brightBase, brightRange] = currentProfile.tiltBrightness
  const [retBase, retRange] = currentProfile.tiltRetention
  const orient = seed.axes[0] ?? 0
  return {
    grainBrightness: brightBase + brightRange * cos2Tilt,
    colorRetention: retBase + retRange * cos2Tilt,
    cosOrient: Math.cos(orient),
    sinOrient: Math.sin(orient),
    noiseOffsetX: seed.noiseOffsetX,
    noiseOffsetY: seed.noiseOffsetY,
  }
}

// ─── Trapped sediment ───────────────────────────────────────────
// Residual mineral particles from a dark layer frozen into the outer skin of
// the next light band (the "post-Mn speckle" of real agate). Split out as pure
// functions so the depth rule and the speckle distribution can be tested
// without a full shading pass.

/** Fine dust lattice pitch, in cells. */
const SPECKLE_FINE_LATTICE = 6
/** Coarse clump lattice pitch, in cells. */
const SPECKLE_CLUMP_LATTICE = 14
/** Fraction of the window, measured from the contact, where clumps can settle. */
const SPECKLE_CLUMP_REACH = 0.45
/** Hash salts for the two particles orbiting a clump's central particle. */
const SPECKLE_CLUMP_SATELLITE_SALTS = [
  [37, 103, 71, 137],
  [149, 211, 191, 239],
] as const

/**
 * Depth in cells that trapped sediment reaches into a band spanning `span`
 * cells. Scales with the band's own width, so a fat zonal quiet zone carries
 * dust well inward while a thin fortification band keeps sediment at the
 * contact. Capped so the onyx central pool does not turn into a dust field.
 */
export function grainWindowDepth(span: number): number {
  return Math.max(1.5, Math.min(span * 0.5, 80))
}

/**
 * Coverage weight of a fine dust particle at a point in the grain window, in
 * 0..1, where 0 means no particle covers the point. `distRatio` is the
 * fraction of the window already crossed: density decays quadratically to
 * zero at the far edge, so the dusting fades instead of clipping to a rim.
 * Low-frequency noise modulates density by angle so sediment never reads as a
 * clean annulus, with some regions carrying dense drifts deeper than others.
 */
export function fineSpeckleWeight(
  dx: number,
  dy: number,
  bandIdx: number,
  hueKey: number,
  distRatio: number,
): number {
  if (distRatio >= 1) return 0

  const seedOff = bandIdx * 977
  const cx = Math.round(dx / SPECKLE_FINE_LATTICE)
  const cy = Math.round(dy / SPECKLE_FINE_LATTICE)

  const radial = (1 - distRatio) * (1 - distRatio)
  const spawn = cellHash(cx * 239 + hueKey + seedOff, cy * 421 + seedOff)
  // Patch modulation cannot exceed 2.05. Rejecting against that upper bound
  // avoids four more hashes inside `valueNoise` for most deep-window cells.
  if (spawn >= 0.70 * radial * 2.05) return 0
  // Period of roughly 60 cells, so a drift spans many lattice cells. The noise
  // offsets rotate per band so adjacent bands do not align their patches.
  const patchN = valueNoise(dx * 0.017 + bandIdx * 31, dy * 0.017 - bandIdx * 17)
  const density = radial * (0.15 + patchN * 1.9)
  // Heavy base rate: against the quadratic falloff and the patch modulation it
  // integrates to an outer skin of dark specks that thins with depth.
  if (spawn >= 0.70 * density) return 0

  const jx = (cellHash(cx + seedOff, cy ^ 907) - 0.5) * SPECKLE_FINE_LATTICE * 0.9
  const jy = (cellHash(cx ^ 131, cy + seedOff) - 0.5) * SPECKLE_FINE_LATTICE * 0.9
  const ddx = dx - (cx * SPECKLE_FINE_LATTICE + jx)
  const ddy = dy - (cy * SPECKLE_FINE_LATTICE + jy)
  const d2 = ddx * ddx + ddy * ddy
  // Small specks dominate; rare larger particles break up the uniform-grain
  // look without dominating the frame.
  const rInner = 0.45 + cellHash(cx ^ (557 + seedOff), cy ^ 283) * 0.50
  const rOuter = rInner + 0.55
  if (d2 >= rOuter * rOuter) return 0

  const d = Math.sqrt(d2)
  return d <= rInner ? 1 : 1 - (d - rInner) / (rOuter - rInner)
}

/**
 * Coverage weight of a coarse clump particle, in 0..1. Clumps are rare
 * groupings of two or three particles that only settle in the outer part of
 * the window, where the largest residual aggregates would have dropped first.
 */
export function clumpSpeckleWeight(
  dx: number,
  dy: number,
  bandIdx: number,
  hueKey: number,
  distRatio: number,
): number {
  if (distRatio >= SPECKLE_CLUMP_REACH) return 0

  const seedOff = bandIdx * 977
  const cx = Math.round(dx / SPECKLE_CLUMP_LATTICE)
  const cy = Math.round(dy / SPECKLE_CLUMP_LATTICE)
  if (cellHash(cx * 281 + hueKey + seedOff, cy * 307 + seedOff) >= 0.06) return 0

  // Anchor for this clump plus two satellites within about four cells.
  const ax = cx * SPECKLE_CLUMP_LATTICE
    + (cellHash(cx + seedOff, cy ^ 733) - 0.5) * SPECKLE_CLUMP_LATTICE * 0.5
  const ay = cy * SPECKLE_CLUMP_LATTICE
    + (cellHash(cx ^ 109, cy + seedOff) - 0.5) * SPECKLE_CLUMP_LATTICE * 0.5
  for (let k = 0; k < 3; k++) {
    const salts = k === 0 ? null : SPECKLE_CLUMP_SATELLITE_SALTS[k - 1]
    const offsetX = salts ? (cellHash(cx ^ salts[0], cy ^ salts[1]) - 0.5) * 7.0 : 0
    const offsetY = salts ? (cellHash(cx ^ salts[2], cy ^ salts[3]) - 0.5) * 7.0 : 0
    const ddx = dx - (ax + offsetX)
    const ddy = dy - (ay + offsetY)
    const d2 = ddx * ddx + ddy * ddy
    const rInner = 0.55 + cellHash(cx ^ (83 + k), cy ^ (127 + k)) * 0.55
    const rOuter = rInner + 0.6
    if (d2 < rOuter * rOuter) {
      const d = Math.sqrt(d2)
      return d <= rInner ? 1 : 1 - (d - rInner) / (rOuter - rInner)
    }
  }
  return 0
}

/**
 * Wall-inward color computation.
 *
 * Writes final RGBA bytes directly to the output buffers without allocating
 * intermediate color objects. Band 0 is at the cavity wall (first deposited),
 * and band N is at the nodule center (last deposited). The fBM warp frame and
 * center fade use the seed-relative `dx` and `dy`, so each nodule samples its
 * own noise region and inner druse bands stay concentric.
 */
export function computeColorWallBased(
  dx: number,
  dy: number,
  wallDistCells: number,
  params: ColorParams,
  seedOrientation: number,
  tiltData: SeedTiltData,
  seedId: number,
  buf: Uint8Array,
  baseBuf: Uint8Array,
  offset: number,
  /** Per-cavity max wall distance (cells). Used to drive the central
   *  druse trigger when this cell is in the deepest 15% of the cavity. */
  cavityMaxWallDist = 0
): void {
  const { bandWavelength, bandAmplitude, baseLightness, saturation, monoHue } = params

  const dist2FromSeed = dx * dx + dy * dy
  const rawDist = wallDistCells < 0 ? 0 : wallDistCells

  // Per-band jitter on the wall-distance axis.
  const bw = bandWavelength > 1 ? bandWavelength : 1
  const pos = rawDist / bw
  const gBandIdx = pos | 0
  const frac = pos - gBandIdx
  const orientKey = (seedOrientation * 100 + 0.5) | 0
  const jitter0 = (cellHash(gBandIdx, orientKey) - 0.5) * bw * 0.3
  const jitter1 = (cellHash(gBandIdx + 1, orientKey) - 0.5) * bw * 0.3
  const sfrac = frac < 0 ? 0 : frac > 1 ? 1 : frac
  const dist = rawDist + jitter0 + (jitter1 - jitter0) * sfrac * sfrac * (3 - 2 * sfrac)

  // fBM warp in the seed's local frame (same as computeColorDirect).
  const cosA = tiltData.cosOrient
  const sinA = tiltData.sinOrient
  const rdx = dx * cosA - dy * sinA
  const rdy = dx * sinA + dy * cosA
  // fBM band warp — tuned against reference agate photos to produce
  // ~6 large waves per revolution instead of ~32 fine ripples.
  //   • noise scale × 0.28  — longer wavelength
  //   • 2 octaves           — no sub-band chatter
  //   • warp strength × 1.25 — visible peak displacement
  const ns = currentProfile.bandNoiseScale * 0.28
  let nx = rdx * ns + tiltData.noiseOffsetX
  let ny = rdy * ns + tiltData.noiseOffsetY
  const pwHL = bandPwHL
  const octaves = 2
  let warp = 0
  let amp = 1.0
  for (let oi = 0; oi < octaves; oi++) {
    warp += amp * (valueNoise(nx, ny) - 0.5)
    amp *= pwHL
    nx *= 2
    ny *= 2
  }
  // Fade warp near nodule centre so innermost druse bands read cleanly.
  // Squared compare avoids sqrt for the 90% of cells outside the fade zone.
  const fadeDist = bandWavelength * currentProfile.bandCenterFadeMultiplier
  const fadeDist2 = fadeDist * fadeDist
  const centerFade = dist2FromSeed < fadeDist2 ? Math.sqrt(dist2FromSeed) / fadeDist : 1
  const warpedDist = dist + warp * bandWavelength * currentProfile.bandWarpStrength * 1.25 * centerFade

  const hueKey = (monoHue + 0.5) | 0
  const absDist = warpedDist < 0 ? -warpedDist : warpedDist
  const baseWidth = bandWavelength * (0.3 + bandAmplitude * 0.7)
  const cumulative = getBandCumulative(hueKey, baseWidth)
  const bandIdx = findBandIndex(cumulative, absDist)

  const band = currentStrategy.getBandColor(bandIdx, hueKey, seedId, baseLightness, saturation)
  let H = band.H
  let L = band.L
  let C = band.C

  // ── Baseline shading (approved iter 2-8) ────────────────────
  // Intra-band radial translucency gradient, low-frequency 2-octave
  // milky cloud modulation, soft band-boundary lerp, grouped gradient
  // for consecutive same-family bands. Tuned against Malawi and
  // green-Brazil reference photos.
  if (bandIdx > 0) {
    const bandStart = cumulative[bandIdx - 1]
    const bandEnd = cumulative[bandIdx]
    const span = bandEnd - bandStart
    if (span > 0) {
      // Group-aware gradient range: consecutive same-family bands
      // share one continuous radial fade. Precomputed per (hueKey,
      // seedId) so per-pixel cost is two Uint16Array reads.
      const groups = getBandGroups(hueKey, seedId, baseLightness, saturation)
      const gStartIdx = groups.start[bandIdx]
      const gEndIdx = groups.end[bandIdx]
      const groupStart = gStartIdx > 0 ? cumulative[gStartIdx - 1] : 0
      const groupEnd = cumulative[gEndIdx]
      const groupSpan = groupEnd - groupStart

      // Translucency gradient uses UNWARPED wall distance so fBM
      // band-warp can't imprint as tangent hatch inside a fat band.
      // Purely radial; continuous across same-family groups.
      const rawCellsFromOuter = rawDist - groupStart
      const pRaw = groupSpan > 0 ? rawCellsFromOuter / groupSpan : 0
      const pcRaw = pRaw < 0 ? 0 : pRaw > 1 ? 1 : pRaw
      // Capped so a very fat band (zonal quiet zone, onyx pool) does not
      // stretch the L spread far enough to read as a gradient wash.
      const widthFactor = Math.min(2.5, Math.sqrt(Math.max(1, groupSpan / 5)))
      const gradBase = L > 0.6 ? -0.040 : L < 0.3 ? 0.018 : -0.028
      L += gradBase * (pcRaw - 0.5) * 2 * widthFactor

      // Milky cloud — 2-octave fBM matching the luminance drift seen
      // across translucent interiors in reference photos. Both octaves
      // are lower frequency than the narrowest band so they can't
      // produce tangent streaks within a band.
      const cloudX0 = dx * 0.005 + tiltData.noiseOffsetX * 0.3
      const cloudY0 = dy * 0.005 + tiltData.noiseOffsetY * 0.3
      const cloudLow = valueNoise(cloudX0, cloudY0) - 0.5
      const cloudX1 = dx * 0.014 + tiltData.noiseOffsetX * 0.7
      const cloudY1 = dy * 0.014 + tiltData.noiseOffsetY * 0.7
      const cloudHi = valueNoise(cloudX1, cloudY1) - 0.5
      L += cloudLow * 0.065 + cloudHi * 0.035
      C = C * (1 + (cloudLow + cloudHi) * 0.18)
      if (C < 0) C = 0

      // Soft outer-edge lerp using the WARPED position (visible band
      // boundary sits there). Skip bandIdx===1 — rim block handles
      // the shell→chalcedony interface with ragged fBM fingers.
      if (bandIdx >= 2) {
        const cellsFromOuter = absDist - bandStart
        const EDGE_CELLS = 1.0
        const edgeWindow = Math.min(EDGE_CELLS, span * 0.5)
        if (cellsFromOuter < edgeWindow) {
          const prev = currentStrategy.getBandColor(bandIdx - 1, hueKey, seedId, baseLightness, saturation)
          const t = cellsFromOuter / edgeWindow
          const w = 0.5 * (1 - t) // 50% at boundary, 0% at edge of window
          L = L + (prev.L - L) * w
          C = C + (prev.C - C) * w
          if (prev.C > 0.01 && C > 0.01) {
            let dH = prev.H - H
            if (dH > 180) dH -= 360
            else if (dH < -180) dH += 360
            H = H + dH * w
          }
        }
      }

    }
  }

  // Onyx pool druse: bright crystal flecks scattered in the solid black
  // central pool. Real onyx pools crystallise as tiny quartz druse that
  // catches light — visible as cream/white specks. Density follows the
  // physics of gravitational settling: sparse near the pool wall (where
  // residual fluid was still washing particles), concentrated toward
  // the centre where particles accumulate in the deepest point.
  if (isOnyxLayout(hueKey) && bandIdx >= 11 && L < 0.10 && cavityMaxWallDist > 0) {
    // Normalised depth into the pool: 0 at the pool boundary, ~1 at centre.
    const poolDepth = Math.min(1, rawDist / cavityMaxWallDist)
    const densityCurve = poolDepth * poolDepth * poolDepth
    const druseNoise = valueNoise(dx * 1.6 + 313, dy * 1.6 + 719)
    const threshold = 0.005 + densityCurve * 0.09
    if (druseNoise < threshold) {
      // Two independent hashes: one for baseline tint, one for per-crystal
      // reflectivity so some facets catch light directly (bright specular)
      // while most stay subdued (ambient light). Quadratic weighting pushes
      // most dots toward the dim end — only a few pop.
      const jitter = cellHash((dx | 0) ^ 829, (dy | 0) ^ 191)
      const refl = cellHash((dx | 0) ^ 443, (dy | 0) ^ 953)
      const reflBoost = refl * refl
      L = 0.45 + jitter * 0.20 + reflBoost * 0.35
      C = 0.008 + jitter * 0.012
    }
  }

  // Rim contamination + residual-grain deposition. Two mechanisms:
  //   (1) ragged band-0/1 boundary from host-rock intrusion
  //   (2) discrete grain stamps in light bands after a dark deposit
  // Shell lookup is only needed for (1) and the band-0 case of (2).
  {
    const needsShell = bandIdx <= 1
    const shell = needsShell
      ? currentStrategy.getBandColor(0, hueKey, seedId, baseLightness, saturation)
      : null
    const shellIsDark = shell ? shell.L < 0.32 : false
    const bandStart = bandIdx > 0 ? cumulative[bandIdx - 1] : 0
    const bandEnd = cumulative[bandIdx]
    const span = bandEnd - bandStart
    const posInBand = span > 0 ? (absDist - bandStart) / span : 0
    const p = posInBand < 0 ? 0 : posInBand > 1 ? 1 : posInBand

    // ── (1) Ragged inner rim edge — fBM-deformed band 0/1 boundary.
    // Only in the outermost sliver of band 1 (first ~7% of it, so zonal
    // fat zones don't get invaded by giant chunks). Higher-frequency
    // warp keeps intrusions thin and finger-like, not blobby.
    if (bandIdx === 1 && shell && shellIsDark && p < 0.07) {
      const fx = dx * 0.45 + hueKey * 0.013
      const fy = dy * 0.45 + hueKey * 0.017
      const coarse = valueNoise(fx, fy) - 0.5
      const medium = (valueNoise(fx * 2.3 + 91, fy * 2.3 + 37) - 0.5) * 0.45
      const fine = (valueNoise(fx * 5.7 + 11, fy * 5.7 + 73) - 0.5) * 0.18
      const warp = coarse + medium + fine
      const threshold = 0.34 * (1 - p / 0.07)
      if (warp > threshold) {
        L = shell.L
        C = shell.C
        H = shell.H
      }
    }

    // ── (2) Discrete trapped grains in any light band deposited after
    // a dark one. Poisson-style stamp lattice — each stamp is a small
    // round particle with a soft edge. Physical model: residual mineral
    // particles from the dark layer get frozen into the outer skin of
    // the next light band (real-agate "post-Mn speckle"). Fires at the
    // rim contact (bandIdx=0, source=host rock) and at every dark→light
    // internal transition (bandIdx>=1, source=previous band).
    const cellsFromOuter = absDist - bandStart
    let sourceBand: BandColor | null = null
    // The grain window scales with band width so sediment embeds up to about
    // half the band's span: a fat zonal quiet zone carries trailing dust
    // toward the middle while thin fortification bands stay bounded to a few
    // outer cells. Capped at 80 cells so the onyx pool does not turn into a
    // dust field.
    const grainMaxCells = grainWindowDepth(span)
    let grainWindow = false
    if (bandIdx === 0) {
      if (shellIsDark) {
        sourceBand = shell
        grainWindow = cellsFromOuter > 0.6 && cellsFromOuter < grainMaxCells
      }
    } else if (bandIdx === 1 && band.L > 0.45) {
      // Sediment settles at the cavity-wall deposition contact: the particles
      // are weathered host-rock debris trapped in the first silica layer, so
      // the window opens whenever band 1 is chalcedony-light, whatever family
      // the Mn shell rolled. A shell that rolled non-dark contributes a dark
      // organic/oxide particle color rather than its own.
      const prev = currentStrategy.getBandColor(bandIdx - 1, hueKey, seedId, baseLightness, saturation)
      sourceBand = prev.L >= 0.30
        ? { L: 0.09, C: 0.015, H: 25 }
        : prev
      grainWindow = cellsFromOuter < grainMaxCells
    }
    if (sourceBand && grainWindow) {
      const distRatio = cellsFromOuter / grainMaxCells

      // Two passes stack: fine dust everywhere in the window, then rare coarse
      // clumps near the contact. Both blend toward the same particle color, so
      // a point covered by each lands closer to it.
      const gL = Math.max(0.05, sourceBand.L - 0.02)

      const tFine = fineSpeckleWeight(dx, dy, bandIdx, hueKey, distRatio)
      if (tFine > 0) {
        L = L + (gL - L) * tFine
        C = C + (sourceBand.C - C) * tFine
        if (sourceBand.C > 0.01) H = H + (sourceBand.H - H) * tFine
      }

      const tClump = clumpSpeckleWeight(dx, dy, bandIdx, hueKey, distRatio)
      if (tClump > 0) {
        L = L + (gL - L) * tClump
        C = C + (sourceBand.C - C) * tClump
        if (sourceBand.C > 0.01) H = H + (sourceBand.H - H) * tClump
      }
    }
  }

  let hIdx = H | 0
  if (hIdx < 0) hIdx += 360
  else if (hIdx >= 360) hIdx -= 360

  const cosH = COS_DEG[hIdx]
  const sinH = SIN_DEG[hIdx]
  const oa = C * cosH
  const ob = C * sinH

  const l_ = L + 0.3963377774 * oa + 0.2158037573 * ob
  const m_ = L - 0.1055613458 * oa - 0.0638541728 * ob
  const s_ = L - 0.0894841775 * oa - 1.2914855480 * ob

  const lc = l_ * l_ * l_
  const mc = m_ * m_ * m_
  const sc = s_ * s_ * s_

  let r = clamp01(linearToSrgbFast(+4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc))
  let g = clamp01(linearToSrgbFast(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc))
  let b = clamp01(linearToSrgbFast(-0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc))

  const { grainBrightness, colorRetention } = tiltData
  const grayLevel = (r * 0.2126 + g * 0.7152 + b * 0.0722) * grainBrightness
  r = clamp01(grayLevel + (r * grainBrightness - grayLevel) * colorRetention)
  g = clamp01(grayLevel + (g * grainBrightness - grayLevel) * colorRetention)
  b = clamp01(grayLevel + (b * grainBrightness - grayLevel) * colorRetention)

  const sh = currentProfile.sheen
  r = r + sh * (1 - r)
  g = g + sh * (1 - g)
  b = b + sh * (1 - b)

  const rb = (r * 255) | 0
  const gb = (g * 255) | 0
  const bb = (b * 255) | 0
  buf[offset] = rb
  buf[offset + 1] = gb
  buf[offset + 2] = bb
  buf[offset + 3] = 255
  baseBuf[offset] = rb
  baseBuf[offset + 1] = gb
  baseBuf[offset + 2] = bb
  baseBuf[offset + 3] = 255
}

/** Invalidate the band width cache (call when palette changes) */
export function invalidateBandCache(): void {
  bandCache = null
  groupCache.clear()
  currentStrategy.reset()
}
