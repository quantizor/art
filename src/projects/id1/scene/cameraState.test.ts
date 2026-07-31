import { describe, it, expect } from 'bun:test'
import { parseCameraState, serializeCameraState } from './cameraState'

describe('parseCameraState', () => {
  it('returns null for null input', () => {
    expect(parseCameraState(null)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseCameraState('not json')).toBeNull()
  })

  it('returns null for JSON that is not an object', () => {
    expect(parseCameraState('42')).toBeNull()
    expect(parseCameraState('"a string"')).toBeNull()
    expect(parseCameraState('null')).toBeNull()
  })

  it('returns null when a field is missing', () => {
    expect(
      parseCameraState(
        JSON.stringify({ px: 1, py: 2, pz: 3, tx: 4, ty: 5 }),
      ),
    ).toBeNull()
  })

  it('returns null when a field is not a finite number', () => {
    expect(
      parseCameraState(
        JSON.stringify({ px: 1, py: 2, pz: 3, tx: 4, ty: 5, tz: 'six' }),
      ),
    ).toBeNull()
    expect(
      parseCameraState(
        JSON.stringify({
          px: Number.POSITIVE_INFINITY,
          py: 2,
          pz: 3,
          tx: 4,
          ty: 5,
          tz: 6,
        }),
      ),
    ).toBeNull()
    expect(
      parseCameraState(
        JSON.stringify({ px: NaN, py: 2, pz: 3, tx: 4, ty: 5, tz: 6 }),
      ),
    ).toBeNull()
  })

  it('returns null when extra unexpected fields replace required ones', () => {
    expect(parseCameraState(JSON.stringify({ foo: 'bar' }))).toBeNull()
  })

  it('returns the parsed state for six finite numbers', () => {
    const state = { px: 1.1, py: 0.49, pz: 0.31, tx: 0, ty: 0.25, tz: 0 }
    expect(parseCameraState(JSON.stringify(state))).toEqual(state)
  })

  it('ignores extra fields on an otherwise valid payload', () => {
    const state = { px: 1, py: 2, pz: 3, tx: 4, ty: 5, tz: 6 }
    expect(
      parseCameraState(JSON.stringify({ ...state, extra: 'field' })),
    ).toEqual(state)
  })
})

describe('serializeCameraState', () => {
  it('round-trips a finite camera state', () => {
    const state = { px: 1.1, py: 0.49, pz: 0.31, tx: 0, ty: 0.25, tz: 0 }
    expect(parseCameraState(serializeCameraState(state))).toEqual(state)
  })

  it('refuses to persist a non-finite camera state', () => {
    const state = { px: NaN, py: 0.49, pz: 0.31, tx: 0, ty: 0.25, tz: 0 }
    expect(serializeCameraState(state)).toBeNull()
  })
})
