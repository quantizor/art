/**
 * Seeded Random Number Generator
 *
 * Mulberry32 PRNG with domain forking for deterministic crystal generation.
 * A 6-character base-36 seed string fully determines a design — same seed
 * always produces the same crystal.
 *
 * Domain forking uses a MurmurHash3-style integer mix so each subsystem
 * (sim params, colors, seed placement, etc.) gets a completely independent
 * PRNG stream. Adding a 7th crystal seed doesn't shift band colors.
 */

/** A function that returns the next random number in [0, 1) */
export type PRNG = () => number

/**
 * Mulberry32 — fast 32-bit PRNG with good statistical properties.
 * Period: 2^32. Passes BigCrush.
 */
export function mulberry32(seed: number): PRNG {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

// ─── Seed String Encoding ───────────────────────────────────

const SEED_LENGTH = 6
const BASE = 36
/** Maximum seed value that fits in 6 base-36 characters: 36^6 - 1 */
export const MAX_SEED_VALUE = Math.pow(BASE, SEED_LENGTH) - 1

/** Encode a numeric seed as a 6-character base-36 string */
export function encodeSeed(n: number): string {
  // Clamp to valid range
  const u = Math.abs(n) % (MAX_SEED_VALUE + 1)
  return u.toString(BASE).padStart(SEED_LENGTH, '0')
}

/** Decode a base-36 seed string back to a number */
export function decodeSeed(s: string): number {
  const n = parseInt(s, BASE)
  if (Number.isNaN(n) || n < 0) return 0
  return Math.min(n, MAX_SEED_VALUE)
}

/** Generate a random seed string (the ONLY place Math.random() is used) */
export function randomSeedString(): string {
  return encodeSeed(Math.floor(Math.random() * (MAX_SEED_VALUE + 1)))
}

// ─── Domain Forking ─────────────────────────────────────────
// Each subsystem gets a unique domain ID. The master seed is mixed
// with the domain ID using a MurmurHash3-style finalizer to produce
// a completely independent PRNG state.

export const DOMAIN = {
  SIM_PARAMS: 0x1,
  COLOR_PARAMS: 0x2,
  COLOR_STRATEGY: 0x3,
  SEED_PLACEMENT: 0x4,
  SEED_CRYSTALS: 0x5,
  BAND_COLORS: 0x6,
} as const

export type DomainId = (typeof DOMAIN)[keyof typeof DOMAIN]

/** MurmurHash3 32-bit finalizer — good avalanche for integer mixing */
function murmurMix(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/** Fork a PRNG for a specific domain from a master seed */
export function forkDomain(masterSeed: number, domain: DomainId): PRNG {
  const mixed = murmurMix((masterSeed >>> 0) ^ (domain * 0x9e3779b9))
  return mulberry32(mixed)
}

/** Fork a PRNG for a specific seed index within a domain */
export function forkSeedDomain(masterSeed: number, domain: DomainId, seedIndex: number): PRNG {
  const mixed = murmurMix(
    (masterSeed >>> 0) ^ (domain * 0x9e3779b9) ^ ((seedIndex + 1) * 0x517cc1b7)
  )
  return mulberry32(mixed)
}
