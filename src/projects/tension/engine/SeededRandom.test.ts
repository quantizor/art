import { describe, it, expect } from 'bun:test'
import {
  mulberry32,
  encodeSeed,
  decodeSeed,
  randomSeedString,
  forkDomain,
  forkSeedDomain,
  DOMAIN,
  MAX_SEED_VALUE,
} from './SeededRandom'

describe('mulberry32', () => {
  it('produces deterministic sequences from the same seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 100 }, () => a())
    const seqB = Array.from({ length: 100 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences from different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(12345)
    for (let i = 0; i < 10000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('seed encoding', () => {
  it('roundtrips encode/decode', () => {
    const values = [0, 1, 42, 999999, MAX_SEED_VALUE, Math.floor(MAX_SEED_VALUE / 2)]
    for (const v of values) {
      expect(decodeSeed(encodeSeed(v))).toBe(v)
    }
  })

  it('produces 6-character lowercase alphanumeric strings', () => {
    for (let i = 0; i < 100; i++) {
      const s = encodeSeed(i * 1000000)
      expect(s).toHaveLength(6)
      expect(s).toMatch(/^[0-9a-z]{6}$/)
    }
  })

  it('returns 0 for invalid input', () => {
    expect(decodeSeed('!!!!')).toBe(0)
    expect(decodeSeed('')).toBe(0)
  })
})

describe('randomSeedString', () => {
  it('produces valid seed strings', () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSeedString()
      expect(s).toHaveLength(6)
      expect(s).toMatch(/^[0-9a-z]{6}$/)
      // Should be decodable
      const n = decodeSeed(s)
      expect(n).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('domain forking', () => {
  it('produces independent streams per domain', () => {
    const master = 0xabcdef01
    const rngA = forkDomain(master, DOMAIN.SIM_PARAMS)
    const rngB = forkDomain(master, DOMAIN.COLOR_PARAMS)

    const seqA = Array.from({ length: 20 }, () => rngA())
    const seqB = Array.from({ length: 20 }, () => rngB())
    expect(seqA).not.toEqual(seqB)
  })

  it('is deterministic: same master + domain = same stream', () => {
    const master = 0x42424242
    const a = forkDomain(master, DOMAIN.BAND_COLORS)
    const b = forkDomain(master, DOMAIN.BAND_COLORS)

    const seqA = Array.from({ length: 50 }, () => a())
    const seqB = Array.from({ length: 50 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('consuming one domain does not affect another', () => {
    const master = 0x99999999

    // Get 10 values from COLOR_PARAMS without touching SIM_PARAMS first
    const rngColor1 = forkDomain(master, DOMAIN.COLOR_PARAMS)
    const colorSeq1 = Array.from({ length: 10 }, () => rngColor1())

    // Now consume 100 values from SIM_PARAMS, then get COLOR_PARAMS
    const rngSim = forkDomain(master, DOMAIN.SIM_PARAMS)
    for (let i = 0; i < 100; i++) rngSim()
    const rngColor2 = forkDomain(master, DOMAIN.COLOR_PARAMS)
    const colorSeq2 = Array.from({ length: 10 }, () => rngColor2())

    expect(colorSeq1).toEqual(colorSeq2)
  })
})

describe('seed-domain forking', () => {
  it('produces different streams per seed index', () => {
    const master = 0x11111111
    const rng0 = forkSeedDomain(master, DOMAIN.SEED_CRYSTALS, 0)
    const rng1 = forkSeedDomain(master, DOMAIN.SEED_CRYSTALS, 1)

    const seq0 = Array.from({ length: 20 }, () => rng0())
    const seq1 = Array.from({ length: 20 }, () => rng1())
    expect(seq0).not.toEqual(seq1)
  })

  it('adding a new seed index does not change existing ones', () => {
    const master = 0x77777777

    // Get sequences for seed 0 and seed 1
    const rng0a = forkSeedDomain(master, DOMAIN.SEED_CRYSTALS, 0)
    const rng1a = forkSeedDomain(master, DOMAIN.SEED_CRYSTALS, 1)
    const seq0a = Array.from({ length: 20 }, () => rng0a())
    const seq1a = Array.from({ length: 20 }, () => rng1a())

    // Now also create seed 2 — seeds 0 and 1 should be unchanged
    forkSeedDomain(master, DOMAIN.SEED_CRYSTALS, 2)
    const rng0b = forkSeedDomain(master, DOMAIN.SEED_CRYSTALS, 0)
    const rng1b = forkSeedDomain(master, DOMAIN.SEED_CRYSTALS, 1)
    const seq0b = Array.from({ length: 20 }, () => rng0b())
    const seq1b = Array.from({ length: 20 }, () => rng1b())

    expect(seq0a).toEqual(seq0b)
    expect(seq1a).toEqual(seq1b)
  })
})
