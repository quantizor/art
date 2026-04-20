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

import type { ColorParams, CrystalProfile, RGBColor } from '../types'
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

/** Cache key → cumulative width array. Evicted when a new palette is set. */
let bandCacheKey = -1
let bandCacheCumulative: Float64Array | null = null
let bandCacheBaseWidth = 0

/**
 * Decide if a nodule uses "single-feedback zone" layout (Malawi-style):
 * one very fat quiet chalcedony band, then a tight cluster of thin accent
 * bands, then a compressed central eye. Deterministic per hueKey so the
 * generator and width arrays agree.
 */
/** User-selected preset override. Forces all seeds into one variant. */
export type VariantPreset = 'random' | 'iris' | 'onyx' | 'zonal' | 'dyed'

let variantOverride: VariantPreset = 'random'

export function setVariantOverride(v: VariantPreset): void {
  variantOverride = v
}

export function getVariantOverride(): VariantPreset {
  return variantOverride
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

/**
 * Get or build the cumulative band-width array for a given hueKey + baseWidth.
 * Returns a Float64Array where entry[i] = sum of widths for bands 0..i.
 */
function getBandCumulative(hueKey: number, baseWidth: number): Float64Array {
  if (bandCacheKey === hueKey && bandCacheBaseWidth === baseWidth && bandCacheCumulative) {
    return bandCacheCumulative
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
      // Fat quiet zone — the Malawi "single-feedback" expanse. Large
      // enough to dominate but leaves room for visible band structure
      // around it, and the renderer adds subtle internal L shading.
      widthFactor = 14 + cellHash(i + 700, hueKey) * 8
    } else if (zonal && i >= 2 && i <= 7) {
      // Tight accent cluster — thicker than a hair seam so the bands
      // actually read as fortification between the fat zone and eye.
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

  bandCacheKey = hueKey
  bandCacheBaseWidth = baseWidth
  bandCacheCumulative = cum
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

// ─── Reusable output buffer ──────────────────────────────────
// Avoids allocating an RGBColor object per pixel in the hot path.
// Callers that need to persist the result must copy the values.

/** Shared output buffer for computeColorDirect */
const _rgb = { r: 0, g: 0, b: 0 }

// ─── Core Functions ──────────────────────────────────────────

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Hermite smoothstep — C1-continuous interpolation in [0,1] */
const smoothstep = (t: number): number => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

// ─── OKLCH -> sRGB Conversion ──────────────────────────────────

/** Linear sRGB -> sRGB gamma curve (exact, for non-hot paths) */
function linearToSrgb(x: number): number {
  if (x <= 0.0031308) return 12.92 * x
  return 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

/**
 * Convert OKLCH to sRGB.
 *
 * @param L - Perceptual lightness (0-1)
 * @param C - Chroma (0 to ~0.37, gamut dependent)
 * @param H - Hue in degrees (0-360)
 */
export function oklchToRgb(L: number, C: number, H: number): RGBColor {
  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

  return {
    r: clamp01(linearToSrgb(rLin)),
    g: clamp01(linearToSrgb(gLin)),
    b: clamp01(linearToSrgb(bLin)),
  }
}

/**
 * Fast OKLCH to sRGB using integer-degree trig LUT and gamma LUT.
 * Writes result into the provided output array [r, g, b] in 0-1 range.
 * Used in hot paths where hue is already quantized to [0, 360).
 */
function oklchToRgbFast(L: number, C: number, H: number, out: RGBColor): void {
  // Quantize hue to integer degree for LUT lookup
  let hIdx = H | 0
  if (hIdx < 0) hIdx += 360
  else if (hIdx >= 360) hIdx -= 360

  const cosH = COS_DEG[hIdx]
  const sinH = SIN_DEG[hIdx]
  const a = C * cosH
  const b = C * sinH

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

  out.r = clamp01(linearToSrgbFast(rLin))
  out.g = clamp01(linearToSrgbFast(gLin))
  out.b = clamp01(linearToSrgbFast(bLin))
}

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

/**
 * Compute final crystal color and write RGBA bytes directly to a buffer.
 *
 * This is the hot-path replacement for computeColor() + addParticle().
 * It avoids all intermediate RGBColor allocations (3 objects per pixel
 * in the original code) by writing directly to the output buffer.
 *
 * Accepts raw (dx, dy) offsets from seed center instead of (angle, dist)
 * to eliminate the atan2/sqrt -> cos/sin roundtrip in the hot loop.
 * The only case that needs angle is the 'linear' growth pattern, which
 * computes it inline from (dx, dy) with a fast atan2 approximation.
 *
 * @param dx - X offset from seed center (in base resolution units)
 * @param dy - Y offset from seed center (in base resolution units)
 * @param params - Color parameters
 * @param seedOrientation - Primary axis angle of the seed
 * @param tiltData - Precomputed tilt data (from precomputeSeedTilt)
 * @param buf - Output Uint8Array (RGBA texture data)
 * @param baseBuf - Output Uint8Array for unstrained base colors (or same as buf if no strain)
 * @param offset - Byte offset into buf where RGBA starts
 */
/**
 * Wall-inward color computation.
 *
 * Identical shading to computeColorDirect except the band-index source
 * is the wall-distance transform (cell units), not the distance from
 * seed. Band 0 is at the cavity wall (first deposited), band N at the
 * nodule centre (last deposited). The fBM warp frame and centre-fade
 * still ride on (dx, dy) from the seed so each nodule samples its own
 * noise region and inner druse bands stay cleanly concentric.
 */
export function computeColorWallBased(
  dx: number,
  dy: number,
  wallDistCells: number,
  params: ColorParams,
  seedOrientation: number,
  tiltData: SeedTiltData,
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
  const ns = currentProfile.bandNoiseScale
  let nx = rdx * ns + tiltData.noiseOffsetX
  let ny = rdy * ns + tiltData.noiseOffsetY
  const pwHL = bandPwHL
  const octaves = currentProfile.bandOctaves
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
  const warpedDist = dist + warp * bandWavelength * currentProfile.bandWarpStrength * centerFade

  const hueKey = (monoHue + 0.5) | 0
  const absDist = warpedDist < 0 ? -warpedDist : warpedDist
  const baseWidth = bandWavelength * (0.3 + bandAmplitude * 0.7)
  const cumulative = getBandCumulative(hueKey, baseWidth)
  const bandIdx = findBandIndex(cumulative, absDist)

  const band = currentStrategy.getBandColor(bandIdx, hueKey, baseLightness, saturation)
  let H = band.H
  let L = band.L
  let C = band.C

  // Zonal fat-zone internal shading: the "single-feedback" expanse is
  // one family across a fat band, but real Malawi shows gentle concentric
  // L modulation within it — slightly brighter at the outer edge, fading
  // darker as chemistry shifts toward the accent cluster.
  if (isZonalLayout(hueKey) && bandIdx === 1) {
    const bandStart = cumulative[0]
    const bandEnd = cumulative[1]
    const span = bandEnd - bandStart
    if (span > 0) {
      const t = (absDist - bandStart) / span // 0 at outer wall, 1 at inner
      const shade = 0.055 * (t - 0.5) // -0.028 at outer, +0.028 at inner
      L = L - shade // outer brighter, inner dimmer
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
      ? currentStrategy.getBandColor(0, hueKey, baseLightness, saturation)
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
    let sourceBand: BandColor | null = null
    let grainWindow = false
    if (bandIdx === 0) {
      if (shellIsDark) {
        sourceBand = shell
        grainWindow = p > 0.05 && p < 0.35
      }
    } else {
      const prev = currentStrategy.getBandColor(bandIdx - 1, hueKey, baseLightness, saturation)
      if (prev.L < 0.32 && band.L > 0.55) {
        sourceBand = prev
        grainWindow = p < 0.28
      }
    }
    if (sourceBand && grainWindow) {
      const LAT = 8
      const cx = Math.round(dx / LAT)
      const cy = Math.round(dy / LAT)
      const seedOff = bandIdx * 977
      const spawn = cellHash(cx * 239 + hueKey + seedOff, cy * 421 + seedOff)
      if (spawn < 0.07) {
        const jx = (cellHash(cx + seedOff, cy ^ 907) - 0.5) * LAT * 0.6
        const jy = (cellHash(cx ^ 131, cy + seedOff) - 0.5) * LAT * 0.6
        const ddx = dx - (cx * LAT + jx)
        const ddy = dy - (cy * LAT + jy)
        const d2 = ddx * ddx + ddy * ddy
        const sizeRoll = cellHash(cx ^ (557 + seedOff), cy ^ 283)
        const rInner = 1.1 + sizeRoll * 0.8
        const rOuter = rInner + 0.9
        const d = Math.sqrt(d2)
        if (d < rOuter) {
          const t = d <= rInner ? 1 : 1 - (d - rInner) / (rOuter - rInner)
          const gL = Math.max(0.05, sourceBand.L - 0.02)
          L = L + (gL - L) * t
          C = C + (sourceBand.C - C) * t
          if (sourceBand.C > 0.01) H = H + (sourceBand.H - H) * t
        }
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

export function computeColorDirect(
  dx: number,
  dy: number,
  params: ColorParams,
  seedOrientation: number,
  tiltData: SeedTiltData,
  buf: Uint8Array,
  baseBuf: Uint8Array,
  offset: number
): void {
  const { growthPattern, bandWavelength, bandAmplitude, baseLightness, saturation, monoHue } = params

  // ── Compute distFromSeed from dx/dy (fast — no sqrt needed for radial,
  //    only need distance for band indexing, not direction) ──
  // For band indexing we need the actual distance, so sqrt is required.
  // However we cache dx*dx+dy*dy for the common case.
  const dist2 = dx * dx + dy * dy
  const distFromSeed = Math.sqrt(dist2)

  // ── growthDistance inlined ──
  let rawDist: number
  if (growthPattern === 'linear') {
    // Need angle only for linear projection — compute from dx/dy directly
    const angle = Math.atan2(dy, dx)
    rawDist = distFromSeed * Math.cos(angle - seedOrientation)
  } else {
    rawDist = distFromSeed
  }

  const bw = bandWavelength > 1 ? bandWavelength : 1
  const pos = (rawDist < 0 ? -rawDist : rawDist) / bw
  const gBandIdx = pos | 0 // fast floor for non-negative values
  const frac = pos - gBandIdx

  const orientKey = (seedOrientation * 100 + 0.5) | 0
  const jitter0 = (cellHash(gBandIdx, orientKey) - 0.5) * bw * 0.3
  const jitter1 = (cellHash(gBandIdx + 1, orientKey) - 0.5) * bw * 0.3
  const sfrac = frac < 0 ? 0 : frac > 1 ? 1 : frac
  const dist = rawDist + jitter0 + (jitter1 - jitter0) * sfrac * sfrac * (3 - 2 * sfrac)

  // ── fBM warp ──
  // Rotate (dx,dy) into the seed's local crystal-axis frame and apply
  // the per-seed noise offset so each seed samples a unique region of
  // the fBM field aligned with its own primary axis. Without this every
  // seed grows an identical warp pattern translated to its center.
  const cosA = tiltData.cosOrient
  const sinA = tiltData.sinOrient
  const rdx = dx * cosA - dy * sinA
  const rdy = dx * sinA + dy * cosA
  const ns = currentProfile.bandNoiseScale
  let nx = rdx * ns + tiltData.noiseOffsetX
  let ny = rdy * ns + tiltData.noiseOffsetY
  // Inline fBM with lacunarity=2, H from profile => pwHL = 2^-H (precomputed)
  const pwHL = bandPwHL
  const octaves = currentProfile.bandOctaves
  let warp = 0
  let amp = 1.0
  for (let oi = 0; oi < octaves; oi++) {
    warp += amp * (valueNoise(nx, ny) - 0.5)
    amp *= pwHL
    nx *= 2
    ny *= 2
  }
  // Fade warp in from center so inner bands stay cleanly concentric
  const fadeDist = bandWavelength * currentProfile.bandCenterFadeMultiplier
  const centerFade = distFromSeed < fadeDist
    ? distFromSeed / fadeDist : 1
  const warpedDist = dist + warp * bandWavelength * currentProfile.bandWarpStrength * centerFade

  // ── Band lookup (binary search) ──
  const hueKey = (monoHue + 0.5) | 0
  const absDist = warpedDist < 0 ? -warpedDist : warpedDist
  const baseWidth = bandWavelength * (0.3 + bandAmplitude * 0.7)
  const cumulative = getBandCumulative(hueKey, baseWidth)
  const bandIdx = findBandIndex(cumulative, absDist)

  // ── Per-band color (delegated to active strategy) ──
  const band = currentStrategy.getBandColor(bandIdx, hueKey, baseLightness, saturation)
  const H = band.H
  const L = band.L
  const C = band.C

  // ── Fast OKLCH -> sRGB (LUT trig + LUT gamma) ──
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

  // ── Tilt desaturation (precomputed per-seed) ──
  const { grainBrightness, colorRetention } = tiltData
  const grayLevel = (r * 0.2126 + g * 0.7152 + b * 0.0722) * grainBrightness
  r = clamp01(grayLevel + (r * grainBrightness - grayLevel) * colorRetention)
  g = clamp01(grayLevel + (g * grainBrightness - grayLevel) * colorRetention)
  b = clamp01(grayLevel + (b * grainBrightness - grayLevel) * colorRetention)

  // ── Sheen (screen blend) ──
  const sh = currentProfile.sheen
  r = r + sh * (1 - r)
  g = g + sh * (1 - g)
  b = b + sh * (1 - b)

  // ── Write RGBA bytes to both display and base texture ──
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
  bandCacheKey = -1
  bandCacheCumulative = null
  currentStrategy.reset()
}
