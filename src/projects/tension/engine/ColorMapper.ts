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

import type { ColorParams, CrystalProfile, GrowthPattern, RGBColor } from '../types'
import { getStrategy, type BandColorStrategy } from './color-strategy'
import { getProfile, DEFAULT_CRYSTAL_TYPE } from '../profiles'
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

let currentProfile: CrystalProfile = getProfile(DEFAULT_CRYSTAL_TYPE)
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
// Precomputes cumulative band widths per hueKey so the while-loop
// in computeAgateColor becomes a binary search (O(log N) vs O(N)).

/** Max bands we precompute (covers distances up to MAX_BANDS * maxBandWidth) */
const MAX_BANDS = 512

/** Cache key → cumulative width array. Evicted when a new palette is set. */
let bandCacheKey = -1
let bandCacheCumulative: Float64Array | null = null
let bandCacheBaseWidth = 0

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
  const rampBands = currentProfile.bandRampBands
  const rampStart = currentProfile.bandRampStart
  const rampExponent = currentProfile.bandRampExponent
  const [widthMin, widthMax] = currentProfile.bandWidthVariation
  const widthRange = widthMax - widthMin
  const rhythmStrength = currentProfile.bandRhythmStrength
  const rhythmFrequency = currentProfile.bandRhythmFrequency
  const thinFrequency = currentProfile.bandThinFrequency
  const thinWidth = currentProfile.bandThinWidth
  for (let i = 0; i < MAX_BANDS; i++) {
    // 1. Power-curve ramp (replaces linear ramp)
    const t = i < rampBands ? (i / rampBands) : 1
    const ramp = rampStart + (1 - rampStart) * Math.pow(t, rampExponent)

    // 2. Random width variation (unchanged)
    let widthFactor = widthMin + cellHash(i + 200, hueKey) * widthRange

    // 3. Rhythmic modulation — sinusoidal thick/thin alternation
    if (rhythmStrength > 0) {
      const rhythm = 0.5 + 0.5 * Math.sin(i * rhythmFrequency * Math.PI * 2)
      widthFactor *= (1 - rhythmStrength * 0.5) + rhythmStrength * rhythm * 0.5
    }

    // 4. Thin accent lines — occasional very narrow bands
    if (thinFrequency > 0 && cellHash(i + 500, hueKey) < thinFrequency) {
      widthFactor *= thinWidth
    }

    acc += baseWidth * widthFactor * ramp
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

/**
 * Convert HSL (degrees, 0-1, 0-1) to RGB (0-1 each)
 * @deprecated Use oklchToRgb for perceptually uniform colors
 */
export function hslToRgb(h: number, s: number, l: number): RGBColor {
  const hNorm = ((h % 360) + 360) % 360
  const C = s * 0.32 * (1 - Math.abs(2 * l - 1))
  return oklchToRgb(l, C, hNorm)
}

/**
 * Thin-film interference color approximation via OKLCH hue sweep.
 *
 * @param t - Optical path difference, normalized to [0, 1) for one order
 */
export function thinFilmSpectrum(
  t: number,
  lightness = 0.62,
  chroma = 0.19
): RGBColor {
  const hue = ((t * 360) % 360 + 360) % 360
  return oklchToRgb(lightness, chroma, hue)
}

/**
 * Simple spatial hash for per-cell noise.
 * Returns a value in [0, 1].
 */
export function cellHash(cx: number, cy: number): number {
  let h = (cx * 374761393 + cy * 668265263) | 0
  h = ((h ^ (h >> 13)) * 1274126177) | 0
  h = (h ^ (h >> 16)) | 0
  return ((h & 0xffff) >>> 0) / 0xffff
}

// ─── Value Noise & fBM ──────────────────────────────────────
// Inspired by Ken Musgrave's fBm functions and srooke.com/fbm.html

/**
 * Continuous 2D value noise via bilinear interpolation of cellHash.
 * Returns a value in [0, 1].
 *
 * Uses bitwise floor that handles negative values correctly:
 * for x >= 0, (x | 0) === Math.floor(x); for x < 0 we subtract 1
 * when there is a fractional part. This avoids the V8 Math.floor
 * deopt in the hot path (~12 calls per pixel via fBM).
 */
export function valueNoise(x: number, y: number): number {
  // Fast floor for potentially negative values
  let ix = x | 0
  if (x < 0 && x !== ix) ix -= 1
  let iy = y | 0
  if (y < 0 && y !== iy) iy -= 1

  const fx = x - ix
  const fy = y - iy

  // Hermite smoothing for C1 continuity
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

/**
 * Fractal Brownian Motion — sums octaves of value noise with
 * increasing frequency and decreasing amplitude.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param octaves - Number of noise layers (3-6 typical)
 * @param lacunarity - Frequency multiplier per octave (typically 2.0)
 * @param H - Hurst exponent controlling amplitude falloff (0.5-1.0)
 */
export function fbm(
  x: number,
  y: number,
  octaves: number,
  lacunarity = 2.0,
  H = 0.8
): number {
  let value = 0
  let amplitude = 1.0
  const pwHL = Math.pow(lacunarity, -H)
  let px = x
  let py = y

  for (let i = 0; i < octaves; i++) {
    value += amplitude * (valueNoise(px, py) - 0.5)
    amplitude *= pwHL
    px *= lacunarity
    py *= lacunarity
  }

  return value
}

// ─── Growth Distance ──────────────────────────────────────────

/**
 * Compute effective growth distance based on pattern type.
 *
 * 'linear': projects distance onto the crystal's orientation axis,
 *           creating a smooth gradient from one edge to the other.
 * 'radial': uses raw distance from seed center, creating concentric
 *           growth rings outward.
 *
 * Both include subtle per-band jitter for organic irregularity.
 */
function growthDistance(
  pattern: GrowthPattern,
  angle: number,
  distFromSeed: number,
  seedOrientation: number,
  bandWavelength: number
): number {
  const rawDist = pattern === 'linear'
    ? distFromSeed * Math.cos(angle - seedOrientation)
    : distFromSeed

  // Smooth jitter: interpolate between per-band noise using hermite blending.
  // Each band gets a unique jitter offset, and smoothstep ensures the
  // transition between adjacent bands is C1-continuous (no visible seams).
  const bw = Math.max(1, bandWavelength)
  const pos = Math.abs(rawDist) / bw
  const bandIdx = Math.floor(pos)
  const frac = pos - bandIdx

  const orientKey = Math.round(seedOrientation * 100)
  const jitter0 = (cellHash(bandIdx, orientKey) - 0.5) * bw * 0.3
  const jitter1 = (cellHash(bandIdx + 1, orientKey) - 0.5) * bw * 0.3

  const jitter = jitter0 + (jitter1 - jitter0) * smoothstep(frac)

  return rawDist + jitter
}

// ─── Mineral Type Functions ──────────────────────────────────

/**
 * Agate: fine earth-tone banding with fBM-warped concentric layers.
 * Uses Musgrave-style fractional Brownian motion to distort band positions,
 * creating the organic irregularity of real chalcedony microcrystalline quartz.
 *
 * Technique inspired by Ken Musgrave's fBm functions (srooke.com/fbm.html).
 */
export function computeAgateColor(
  angle: number,
  distFromSeed: number,
  params: ColorParams,
  seedOrientation: number,
  seedTilt: number
): RGBColor {
  const { growthPattern, bandWavelength, bandAmplitude, baseLightness, saturation, monoHue } = params

  const dist = growthDistance(growthPattern, angle, distFromSeed, seedOrientation, bandWavelength)

  // Approximate 2D coords for fBM sampling
  const px = Math.cos(angle) * distFromSeed
  const py = Math.sin(angle) * distFromSeed

  // fBM warp: organic band boundary shapes
  const noiseScale = currentProfile.bandNoiseScale
  const warp = fbm(px * noiseScale, py * noiseScale, currentProfile.bandOctaves, 2.0, currentProfile.bandH)
  // Fade warp in from center so inner bands stay cleanly concentric
  const fadeDist = bandWavelength * currentProfile.bandCenterFadeMultiplier
  const centerFade = distFromSeed < fadeDist
    ? distFromSeed / fadeDist : 1
  const warpedDist = dist + warp * bandWavelength * currentProfile.bandWarpStrength * centerFade

  // Variable-width band indexing via precomputed cumulative widths.
  // Binary search replaces the per-pixel while-loop that iterated
  // 20-100 times. The cache is keyed on (hueKey, baseWidth) and
  // rebuilt only when the palette changes.
  const hueKey = Math.round(monoHue)
  const absDist = Math.abs(warpedDist)
  const baseWidth = bandWavelength * (0.3 + bandAmplitude * 0.7)
  const cumulative = getBandCumulative(hueKey, baseWidth)
  const bandIdx = findBandIndex(cumulative, absDist)

  // Delegate band color to the active strategy (pluggable per-band color logic)
  const band = currentStrategy.getBandColor(bandIdx, hueKey, baseLightness, saturation)

  // Use fast LUT-based conversion (integer-degree hue, gamma LUT)
  oklchToRgbFast(band.L, band.C, band.H, _rgb)
  return { r: _rgb.r, g: _rgb.g, b: _rgb.b }
}

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

// ─── Main Color Dispatcher ──────────────────────────────────

export function computeColor(
  angle: number,
  distFromSeed: number,
  params: ColorParams,
  seedOrientation?: number,
  seedTilt?: number,
  boundaryPressure?: number
): RGBColor {
  const { baseLightness, saturation } = params
  const orient = seedOrientation ?? 0
  const tilt = seedTilt ?? 0

  let rgb: RGBColor = computeAgateColor(angle, distFromSeed, params, orient, tilt)

  // Universal tilt: subtle brightness + saturation variation (not extinction)
  const cosTilt = Math.cos(tilt)
  const cos2Tilt = cosTilt * cosTilt
  const [brightBase, brightRange] = currentProfile.tiltBrightness
  const [retBase, retRange] = currentProfile.tiltRetention
  const grainBrightness = brightBase + brightRange * cos2Tilt
  const grayLevel = (rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722) * grainBrightness
  const colorRetention = retBase + retRange * cos2Tilt
  rgb = {
    r: clamp01(grayLevel + (rgb.r * grainBrightness - grayLevel) * colorRetention),
    g: clamp01(grayLevel + (rgb.g * grainBrightness - grayLevel) * colorRetention),
    b: clamp01(grayLevel + (rgb.b * grainBrightness - grayLevel) * colorRetention),
  }

  if (boundaryPressure && boundaryPressure > 0) {
    rgb = applyStrainEffects(rgb, boundaryPressure, angle, distFromSeed, baseLightness, saturation)
  }

  // Even polished-surface sheen — screen blend lifts darks gently,
  // barely touches brights, simulating ambient light on polished crystal
  const sheen = currentProfile.sheen
  rgb = {
    r: clamp01(rgb.r + sheen * (1 - rgb.r)),
    g: clamp01(rgb.g + sheen * (1 - rgb.g)),
    b: clamp01(rgb.b + sheen * (1 - rgb.b)),
  }

  return rgb
}

/**
 * Photoelastic strain effects at grain boundaries.
 */
export function applyStrainEffects(
  color: RGBColor,
  pressure: number,
  angle: number,
  distFromSeed: number,
  baseLightness = 0.58,
  saturation = 0.72
): RGBColor {
  const p = Math.min(pressure, 2)

  const strainT = ((distFromSeed * 0.08 + angle * 0.5) % 1 + 1) % 1
  const L = 0.38 + baseLightness * 0.35
  const C = saturation * 0.24
  const strainColor = thinFilmSpectrum(strainT, L, C)

  const strainMix = p * 0.08
  const darkMix = p * 0.04
  const baseFactor = 1 - strainMix - darkMix

  return {
    r: clamp01(color.r * baseFactor + strainColor.r * strainMix),
    g: clamp01(color.g * baseFactor + strainColor.g * strainMix),
    b: clamp01(color.b * baseFactor + strainColor.b * strainMix),
  }
}

/** Invalidate the band width cache (call when palette changes) */
export function invalidateBandCache(): void {
  bandCacheKey = -1
  bandCacheCumulative = null
  currentStrategy.reset()
}
