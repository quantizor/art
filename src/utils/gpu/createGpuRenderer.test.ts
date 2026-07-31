import { describe, test, expect } from 'bun:test'
import { gpuAudit, isWebGpuAvailable } from './createGpuRenderer'

describe('isWebGpuAvailable', () => {
  test('is false when navigator.gpu is absent (bun test environment)', () => {
    expect(isWebGpuAvailable()).toBe(false)
  })
})

describe('gpuAudit', () => {
  test('maps renderer.info.memory fields to the audit snapshot', () => {
    const fakeRenderer = {
      info: {
        memory: {
          geometries: 3,
          renderTargets: 1,
          textures: 7,
          total: 1024,
        },
      },
    }

    expect(gpuAudit(fakeRenderer)).toEqual({
      geometries: 3,
      renderTargets: 1,
      textures: 7,
      totalBytes: 1024,
    })
  })
})
