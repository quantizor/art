import type { Seed } from '../types'

export interface PartitionRequest {
  H: number
  W: number
  id: number
  noiseScale: number
  seeds: Seed[]
  type: 'partition-request'
  warpStrength: number
}

export interface PartitionResponse {
  gridBuffer: ArrayBuffer
  id: number
  type: 'partition-response'
  wallBuffer: ArrayBuffer
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isSeed(value: unknown): value is Seed {
  if (typeof value !== 'object' || value === null) return false
  const seed = value as Record<string, unknown>
  return (
    Array.isArray(seed.axes) &&
    seed.axes.every(isFiniteNumber) &&
    isFiniteNumber(seed.aspectRatio) &&
    isFiniteNumber(seed.id) &&
    isFiniteNumber(seed.maxRadius) &&
    isFiniteNumber(seed.noiseOffsetX) &&
    isFiniteNumber(seed.noiseOffsetY) &&
    isFiniteNumber(seed.tilt) &&
    isFiniteNumber(seed.x) &&
    isFiniteNumber(seed.y)
  )
}

export function isPartitionRequest(data: unknown): data is PartitionRequest {
  if (typeof data !== 'object' || data === null) return false
  const request = data as Record<string, unknown>
  return (
    request.type === 'partition-request' &&
    isInteger(request.id) &&
    isInteger(request.W) &&
    isInteger(request.H) &&
    Array.isArray(request.seeds) &&
    request.seeds.every(isSeed) &&
    isFiniteNumber(request.noiseScale) &&
    isFiniteNumber(request.warpStrength)
  )
}

export function isPartitionResponse(data: unknown): data is PartitionResponse {
  if (typeof data !== 'object' || data === null) return false
  const response = data as Record<string, unknown>
  return (
    response.type === 'partition-response' &&
    isInteger(response.id) &&
    response.gridBuffer instanceof ArrayBuffer &&
    response.wallBuffer instanceof ArrayBuffer
  )
}
